const fs = require('fs');
const path = require('path');

const docsSrcDir = path.join(__dirname, '../src/docs');
const outputDir = path.join(__dirname, '../docs');
const outputFile = path.join(outputDir, 'index.html');
const packageJsonFile = path.join(__dirname, '../package.json');

console.log('📚 Building documentation site...');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// 1. Read package.json to get version
let version = '1.0.0';
try {
    const pkg = JSON.parse(fs.readFileSync(packageJsonFile, 'utf8'));
    version = pkg.version;
} catch (err) {
    console.warn('⚠️ Could not read package.json version:', err.message);
}

// 2. Read and combine all markdown files in order
if (!fs.existsSync(docsSrcDir)) {
    console.error('❌ Documentation source directory not found:', docsSrcDir);
    process.exit(1);
}

const files = fs.readdirSync(docsSrcDir)
    .filter(f => f.endsWith('.md'))
    .sort();

if (files.length === 0) {
    console.error('❌ No markdown files found in:', docsSrcDir);
    process.exit(1);
}

let combinedMarkdown = '';
for (const file of files) {
    console.log(`   📄 Reading ${file}...`);
    combinedMarkdown += fs.readFileSync(path.join(docsSrcDir, file), 'utf8') + '\n\n';
}

const changelogFile = path.join(__dirname, '../CHANGELOG.md');
if (fs.existsSync(changelogFile)) {
    console.log(`   📄 Reading CHANGELOG.md...`);
    combinedMarkdown += fs.readFileSync(changelogFile, 'utf8') + '\n\n';
}

// 3. Copy non-markdown assets (SVG, PNG, etc.) to the output docs folder
const assets = fs.readdirSync(docsSrcDir)
    .filter(f => !f.endsWith('.md'));

for (const asset of assets) {
    const srcPath = path.join(docsSrcDir, asset);
    const destPath = path.join(outputDir, asset);
    if (fs.statSync(srcPath).isFile()) {
        console.log(`   📦 Copying asset ${asset}...`);
        fs.copyFileSync(srcPath, destPath);
    }
}

// Helper to create URL-friendly slugs
function slugify(text) {
    return text.toLowerCase()
        .replace(/[^\w\s-]/g, '') // remove special chars
        .replace(/[\s_]+/g, '-')  // replace spaces/underscores with hyphens
        .replace(/^-+|-+$/g, ''); // trim hyphens
}

// Parse Table Rows
function renderTable(rows) {
    let html = '<div class="table-container"><table>\n';
    rows.forEach((row, i) => {
        const tag = i === 0 ? 'th' : 'td';
        html += '  <tr>\n';
        row.forEach(cell => {
            html += `    <${tag}>${cell}</${tag}>\n`;
        });
        html += '  </tr>\n';
    });
    html += '</table></div>';
    return html;
}

// 3. Regex-based Markdown to HTML parser
function markdownToHtml(md) {
    let html = md;
    
    // Fix table pipe escaping before we process inline code and tables
    html = html.replace(/\\\|/g, '&#124;');
    
    const codeBlocks = [];

    // Extract code blocks first to protect their contents from being modified
    html = html.replace(/```(\w*)\n([\s\S]*?)\n```/g, (match, lang, code) => {
        const id = `__CODE_BLOCK_${codeBlocks.length}__`;
        const escapedCode = code
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
        codeBlocks.push({
            id,
            lang: lang || 'javascript',
            code: escapedCode
        });
        return id;
    });

    // Headers with IDs
    html = html.replace(/^###### (.*)$/gm, (m, title) => `<h6 id="${slugify(title)}">${title}</h6>`);
    html = html.replace(/^##### (.*)$/gm, (m, title) => `<h5 id="${slugify(title)}">${title}</h5>`);
    html = html.replace(/^#### (.*)$/gm, (m, title) => `<h4 id="${slugify(title)}">${title}</h4>`);
    html = html.replace(/^### (.*)$/gm, (m, title) => `<h3 id="${slugify(title)}">${title}</h3>`);
    html = html.replace(/^## (.*)$/gm, (m, title) => `<h2 id="${slugify(title)}">${title}</h2>`);
    html = html.replace(/^# (.*)$/gm, (m, title) => `<h1 id="${slugify(title)}">${title}</h1>`);

    // Horizontal rules
    html = html.replace(/^---$/gm, '<hr>');

    // Bold, links, inline code
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/`([^`]+)`/g, (match, code) => '<code>' + code.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code>');
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');

    // Parse Markdown tables
    const lines = html.split('\n');
    let inTable = false;
    let tableRows = [];
    let parsedLines = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
            if (!inTable) {
                inTable = true;
                tableRows = [];
            }
            if (trimmed.includes('---')) {
                // skip table separator lines like |---|---|
                continue;
            }
            const cells = trimmed.split('|').slice(1, -1).map(c => c.trim());
            tableRows.push(cells);
        } else {
            if (inTable) {
                parsedLines.push(renderTable(tableRows));
                inTable = false;
            }
            parsedLines.push(line);
        }
    }
    if (inTable) {
        parsedLines.push(renderTable(tableRows));
    }
    html = parsedLines.join('\n');

    // Parse lists (both - and * bullet points)
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
    
    // Group adjacent li items into ul blocks
    // Since JavaScript regex doesn't easily group variable matches across multiple lines,
    // we split and wrap them step-by-step:
    const finalLines = html.split('\n');
    let inList = false;
    const processedLines = [];
    for (const line of finalLines) {
        if (line.trim().startsWith('<li>')) {
            if (!inList) {
                processedLines.push('<ul>');
                inList = true;
            }
            processedLines.push(line);
        } else {
            if (inList) {
                processedLines.push('</ul>');
                inList = false;
            }
            processedLines.push(line);
        }
    }
    if (inList) {
        processedLines.push('</ul>');
    }
    html = processedLines.join('\n');

    // Paragraphs: separate non-empty, non-block HTML tag lines into paragraphs
    const blocks = html.split(/\n{2,}/);
    const blockTags = ['<h', '<ul', '<ol', '<li', '<pre', '<table', '<tr', '<td', '<th', '<div', '<blockquote', '<p', '<hr'];
    html = blocks.map(block => {
        const trimmed = block.trim();
        if (!trimmed) return '';
        if (trimmed.startsWith('__CODE_BLOCK_')) return trimmed;
        const startsWithBlockTag = blockTags.some(tag => trimmed.toLowerCase().startsWith(tag));
        if (startsWithBlockTag) return trimmed;
        return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    }).join('\n\n');

    // Restore code blocks with a Prism wrapper
    codeBlocks.forEach(item => {
        const preHtml = `
<div class="code-wrapper">
  <button class="copy-code-btn" aria-label="Copy code">Copy</button>
  <pre><code class="language-${item.lang}">${item.code}</code></pre>
</div>`;
        html = html.replace(item.id, preHtml);
    });

    return html;
}

// 4. Generate Table of Contents (TOC) data
const contentHtml = markdownToHtml(combinedMarkdown);
const toc = [];

const headingRegex = /<h([123]) id="([^"]+)">([^<]+)<\/h\1>/g;
let match;
while ((match = headingRegex.exec(contentHtml)) !== null) {
    toc.push({
        level: parseInt(match[1]),
        id: match[2],
        text: match[3]
    });
}

// 5. Build Sidebar HTML
let sidebarHtml = '<ul class="nav-list">\n';
toc.forEach(item => {
    let depthClass = 'nav-item-main';
    if (item.level === 2) depthClass = 'nav-item-sub';
    if (item.level === 3) depthClass = 'nav-item-sub-sub';
    sidebarHtml += `  <li class="nav-item ${depthClass}"><a href="#${item.id}">${item.text}</a></li>\n`;
});
sidebarHtml += '</ul>';

// 6. Define full HTML template
const template = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>mini-inject — Minimalistic Dependency Injection</title>
  <meta name="description" content="A minimalistic dependency injection implementation for Node.js and TypeScript. ESM and CJS supported. No decorators required.">
  <link rel="icon" type="image/svg+xml" href="mini-inject.svg">
  
  <!-- Typography & Icons -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500;600&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  
  <!-- Code Highlighting Theme (Prism) -->
  <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-okaidia.min.css" rel="stylesheet" />

  <style>
    /* Design Tokens & CSS Variables */
    :root {
      /* Base fonts */
      --font-sans: 'Inter', system-ui, -apple-system, sans-serif;
      --font-mono: 'Fira Code', monospace;

      /* OS Preference / Default Fallbacks (Light Mode Defaults) */
      --bg-primary: #f8fafc;
      --bg-sidebar: #ffffff;
      --bg-code: #1e293b;
      --text-primary: #0f172a;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
      --primary-color: #6366f1;
      --primary-hover: #4f46e5;
      --primary-light: #e0e7ff;
      --accent-color: #818cf8;
      
      --copy-btn-bg: rgba(255, 255, 255, 0.15);
      --copy-btn-text: #f8fafc;
      
      --sidebar-width: 300px;
      --header-height: 60px;
    }

    /* Auto Dark Mode overrides based on OS */
    @media (prefers-color-scheme: dark) {
      :root {
        --bg-primary: #0f172a;
        --bg-sidebar: #1e293b;
        --bg-code: #0f172a;
        --text-primary: #f1f5f9;
        --text-muted: #94a3b8;
        --border-color: #334155;
        --primary-color: #818cf8;
        --primary-hover: #6366f1;
        --primary-light: #312e81;
        --accent-color: #a5b4fc;
      }
    }

    /* Base Styling */
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html {
      scroll-behavior: smooth;
    }

    body {
      font-family: var(--font-sans);
      background-color: var(--bg-primary);
      color: var(--text-primary);
      line-height: 1.6;
      -webkit-font-smoothing: antialiased;
      display: flex;
    }

    /* Sidebar Layout */
    .sidebar {
      width: var(--sidebar-width);
      height: 100vh;
      position: fixed;
      left: 0;
      top: 0;
      background-color: var(--bg-sidebar);
      border-right: 1px solid var(--border-color);
      display: flex;
      flex-direction: column;
      z-index: 100;
      transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .sidebar-header {
      padding: 24px;
      border-bottom: 1px solid var(--border-color);
    }

    .logo-container {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
    }

    .logo-img {
      width: 24px;
      height: 24px;
      object-fit: contain;
    }

    .logo-title {
      font-weight: 700;
      font-size: 20px;
      letter-spacing: -0.025em;
      background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    .version-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      background-color: var(--primary-light);
      color: var(--primary-color);
      border-radius: 9999px;
      display: inline-block;
    }

    .search-box {
      width: 100%;
      padding: 10px 16px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background-color: var(--bg-primary);
      color: var(--text-primary);
      font-family: var(--font-sans);
      font-size: 14px;
      outline: none;
      transition: border-color 0.2s ease;
    }

    .search-box:focus {
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15);
    }

    .sidebar-nav {
      flex: 1;
      overflow-y: auto;
      padding: 16px 24px;
    }

    .nav-list {
      list-style: none;
    }

    .nav-item {
      margin-bottom: 8px;
    }

    .nav-item a {
      text-decoration: none;
      color: var(--text-muted);
      font-size: 14px;
      font-weight: 500;
      display: block;
      padding: 6px 12px;
      border-radius: 6px;
      transition: all 0.2s ease;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .nav-item a:hover {
      color: var(--primary-color);
      background-color: var(--bg-primary);
    }

    .nav-item.nav-item-sub {
      margin-left: 12px;
    }

    .nav-item.nav-item-sub a {
      font-size: 13px;
      font-weight: 400;
    }

    .nav-item.nav-item-sub-sub {
      margin-left: 24px;
    }

    .nav-item.nav-item-sub-sub a {
      font-size: 12px;
      font-weight: 400;
    }

    .nav-item.active a {
      color: var(--primary-color);
      background-color: var(--primary-light);
      font-weight: 600;
    }

    .sidebar-footer {
      padding: 20px 24px;
      border-top: 1px solid var(--border-color);
      display: flex;
      gap: 16px;
    }

    .footer-link {
      text-decoration: none;
      color: var(--text-muted);
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 500;
      transition: color 0.2s ease;
    }

    .footer-link:hover {
      color: var(--primary-color);
    }

    /* Content Area */
    .main-content {
      margin-left: var(--sidebar-width);
      flex: 1;
      padding: 60px 80px;
      max-width: 1100px;
    }

    /* Mobile Header */
    .mobile-header {
      display: none;
      height: var(--header-height);
      background-color: var(--bg-sidebar);
      border-bottom: 1px solid var(--border-color);
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 90;
      align-items: center;
      padding: 0 20px;
      justify-content: space-between;
    }

    .hamburger-btn {
      background: none;
      border: none;
      color: var(--text-primary);
      font-size: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .mobile-title {
      font-weight: 700;
      font-size: 16px;
      background: linear-gradient(135deg, var(--primary-color), var(--accent-color));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    /* Content Styling */
    h1, h2, h3 {
      font-weight: 700;
      letter-spacing: -0.03em;
      margin-top: 40px;
      margin-bottom: 16px;
      color: var(--text-primary);
    }

    h1 {
      font-size: 40px;
      line-height: 1.2;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 16px;
      margin-top: 0;
    }

    h2 {
      font-size: 26px;
      border-bottom: 1px solid var(--border-color);
      padding-bottom: 8px;
    }

    h3 {
      font-size: 20px;
    }

    p {
      margin-bottom: 20px;
      color: var(--text-primary);
      opacity: 0.9;
    }

    a {
      color: var(--primary-color);
      text-decoration: none;
      transition: color 0.15s ease;
      font-weight: 500;
    }

    a:hover {
      color: var(--primary-hover);
      text-decoration: underline;
    }

    /* Code Block styling */
    .code-wrapper {
      position: relative;
      margin: 24px 0;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    pre[class*="language-"] {
      margin: 0 !important;
      border-radius: 0 !important;
      background: var(--bg-code) !important;
      padding: 20px !important;
      font-family: var(--font-mono) !important;
      font-size: 14px !important;
    }

    code {
      font-family: var(--font-mono);
      font-size: 13.5px;
      background-color: var(--border-color);
      padding: 2px 6px;
      border-radius: 4px;
      color: var(--text-primary);
    }

    pre code {
      background-color: transparent;
      padding: 0;
      border-radius: 0;
      color: inherit;
    }

    .copy-code-btn {
      position: absolute;
      top: 12px;
      right: 12px;
      background: var(--copy-btn-bg);
      border: none;
      color: var(--copy-btn-text);
      padding: 6px 12px;
      font-size: 11px;
      font-weight: 600;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.2s ease;
      z-index: 10;
      backdrop-filter: blur(4px);
    }

    .copy-code-btn:hover {
      background: rgba(255, 255, 255, 0.25);
    }

    /* Tables */
    .table-container {
      width: 100%;
      overflow-x: auto;
      margin: 24px 0;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      box-shadow: 0 2px 8px rgba(0,0,0,0.02);
    }

    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 14px;
    }

    th, td {
      padding: 12px 16px;
      border-bottom: 1px solid var(--border-color);
    }

    th {
      font-weight: 600;
      background-color: var(--bg-sidebar);
      color: var(--text-primary);
    }

    tr:last-child td {
      border-bottom: none;
    }

    /* Lists */
    ul, ol {
      margin-left: 24px;
      margin-bottom: 20px;
    }

    li {
      margin-bottom: 8px;
    }

    /* Divider */
    hr {
      border: none;
      height: 1px;
      background-color: var(--border-color);
      margin: 48px 0;
    }

    /* Overlay for mobile */
    .sidebar-overlay {
      display: none;
      position: fixed;
      inset: 0;
      background: rgba(15, 23, 42, 0.4);
      backdrop-filter: blur(2px);
      z-index: 95;
    }

    /* Responsive adjustments */
    @media (max-width: 900px) {
      body {
        flex-direction: column;
      }

      .sidebar {
        transform: translateX(-100%);
        top: var(--header-height);
        height: calc(100vh - var(--header-height));
        width: 280px;
      }

      .sidebar.open {
        transform: translateX(0);
      }

      .sidebar-overlay.open {
        display: block;
      }

      .main-content {
        margin-left: 0;
        padding: 40px 24px;
        margin-top: var(--header-height);
      }

      .mobile-header {
        display: flex;
      }
    }
  </style>
</head>
<body>

  <!-- Mobile Header -->
  <header class="mobile-header">
    <button class="hamburger-btn" id="hamburger" aria-label="Toggle Navigation Menu">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="3" y1="12" x2="21" y2="12"></line>
        <line x1="3" y1="6" x2="21" y2="6"></line>
        <line x1="3" y1="18" x2="21" y2="18"></line>
      </svg>
    </button>
    <div class="mobile-title">mini-inject docs</div>
    <div class="version-badge">v${version}</div>
  </header>

  <!-- Sidebar Overlay -->
  <div class="sidebar-overlay" id="overlay"></div>

  <!-- Sidebar -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-header">
      <div class="logo-container">
        <img src="mini-inject.svg" alt="mini-inject logo" class="logo-img">
        <span class="logo-title">mini-inject</span>
      </div>
      <div style="margin-bottom: 16px;">
        <span class="version-badge">v${version}</span>
      </div>
      <input type="text" id="search" class="search-box" placeholder="Search documentation...">
    </div>
    
    <nav class="sidebar-nav">
      ${sidebarHtml}
    </nav>
    
    <div class="sidebar-footer">
      <a href="https://github.com/fernando7jr/mini-inject" class="footer-link" target="_blank" rel="noopener">
        <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"></path>
        </svg>
        GitHub
      </a>
      <a href="https://www.npmjs.com/package/mini-inject" class="footer-link" target="_blank" rel="noopener">
        <svg height="16" width="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M1.763 0C.786 0 0 .786 0 1.763v20.474C0 23.214.786 24 1.763 24h20.474c.977 0 1.763-.786 1.763-1.763V1.763C24 .786 23.214 0 22.237 0zM5.13 5.323l13.837.019-.009 13.836h-3.464l.01-10.382h-3.456L12.04 19.17H5.113z"/>
        </svg>
        npm
      </a>
    </div>
  </aside>

  <!-- Main Content -->
  <main class="main-content">
    ${contentHtml}
  </main>

  <!-- Prism Syntax Highlighting -->
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"></script>

  <script>
    // 1. Mobile Menu Toggling
    const hamburger = document.getElementById('hamburger');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');

    function toggleMenu() {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
    }

    hamburger.addEventListener('click', toggleMenu);
    overlay.addEventListener('click', toggleMenu);
    
    // Close sidebar on navigation item click (mobile)
    const navLinks = document.querySelectorAll('.nav-item a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            if (sidebar.classList.contains('open')) {
                toggleMenu();
            }
        });
    });

    // 2. Active Menu Tracking (Scrollspy)
    const headers = Array.from(document.querySelectorAll('h2, h3'));
    const sidebarItems = Array.from(document.querySelectorAll('.nav-item'));

    window.addEventListener('scroll', () => {
        let currentActiveId = '';
        const scrollPosition = window.scrollY + 100;

        for (let i = headers.length - 1; i >= 0; i--) {
            if (scrollPosition >= headers[i].offsetTop) {
                currentActiveId = headers[i].id;
                break;
            }
        }

        sidebarItems.forEach(item => {
            const link = item.querySelector('a');
            if (link && link.getAttribute('href') === '#' + currentActiveId) {
                item.classList.add('active');
                // Scroll the sidebar navigation if needed to keep active element in view
                item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            } else {
                item.classList.remove('active');
            }
        });
    });

    // 3. Instant Search Filter
    const searchInput = document.getElementById('search');
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase().trim();
        
        sidebarItems.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(query)) {
                item.style.display = 'block';
            } else {
                item.style.display = 'none';
            }
        });
    });

    // 4. Code Blocks Copy Feature
    document.querySelectorAll('.code-wrapper').forEach(wrapper => {
        const button = wrapper.querySelector('.copy-code-btn');
        const codeElement = wrapper.querySelector('pre code');

        button.addEventListener('click', () => {
            const text = codeElement.innerText;
            navigator.clipboard.writeText(text).then(() => {
                button.textContent = 'Copied!';
                button.style.backgroundColor = 'var(--primary-color)';
                setTimeout(() => {
                    button.textContent = 'Copy';
                    button.style.backgroundColor = 'var(--copy-btn-bg)';
                }, 2000);
            }).catch(err => {
                console.error('Failed to copy text: ', err);
            });
        });
    });
  </script>
</body>
</html>
`;

// 7. Write final html output
fs.writeFileSync(outputFile, template, 'utf8');
console.log('🎉 Documentation compiled successfully to docs/index.html!');

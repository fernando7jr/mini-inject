#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, 'src', 'mini-inject.js');
const sourceTypesFile = path.join(__dirname, 'src', 'mini-inject.d.ts');
const distDir = __dirname;

console.log('🔨 Building mini-inject distribution files...\n');

// Ensure source files exist
if (!fs.existsSync(sourceFile)) {
    console.error('❌ Source file not found:', sourceFile);
    process.exit(1);
}

if (!fs.existsSync(sourceTypesFile)) {
    console.error('❌ Source TypeScript definitions not found:', sourceTypesFile);
    process.exit(1);
}

// Read the source files
const sourceCode = fs.readFileSync(sourceFile, 'utf8');
const sourceTypes = fs.readFileSync(sourceTypesFile, 'utf8');

// Validate source has export statement
if (!sourceCode.includes('export {')) {
    console.error('❌ Source file must contain export statement');
    process.exit(1);
}

// Generate CommonJS version
const cjsCode = sourceCode.replace(
    /^export \{ (.+) \};?$/m,
    'module.exports = { $1 };'
);

// Generate ES Module version (source is already in ESM format)
const esmCode = sourceCode;

// Generate CommonJS wrapper for index.js
const indexJsCode = `module.exports = require('./index.cjs');\n`;

// Generate TypeScript definitions
// For CommonJS (.d.ts) - keep as is (already uses export)
const cjsTypes = sourceTypes;

// For ES Modules (.d.mts) - keep as is (already uses export)
const esmTypes = sourceTypes;

try {
    // Write JavaScript files
    fs.writeFileSync(path.join(distDir, 'index.cjs'), cjsCode);
    console.log('✅ Generated index.cjs (CommonJS)');
    
    fs.writeFileSync(path.join(distDir, 'index.mjs'), esmCode);
    console.log('✅ Generated index.mjs (ES Module)');
    
    fs.writeFileSync(path.join(distDir, 'index.js'), indexJsCode);
    console.log('✅ Generated index.js (CJS wrapper)');

    // Write TypeScript definition files
    fs.writeFileSync(path.join(distDir, 'index.d.ts'), cjsTypes);
    console.log('✅ Generated index.d.ts (TypeScript definitions for CJS)');
    
    fs.writeFileSync(path.join(distDir, 'index.d.mts'), esmTypes);
    console.log('✅ Generated index.d.mts (TypeScript definitions for ESM)');
    
    console.log('\n🎉 Build completed successfully!');
    console.log('📦 Ready for npm publish with files:');
    console.log('   - index.js, index.cjs, index.mjs (JavaScript)');
    console.log('   - index.d.ts, index.d.mts (TypeScript definitions)'); 
    console.log('   - package.json, README.md, LICENSE');
    
} catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
}

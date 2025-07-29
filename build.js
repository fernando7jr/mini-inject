#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const sourceFile = path.join(__dirname, 'src', 'mini-inject.js');
const sourceTypesFile = path.join(__dirname, 'src', 'mini-inject.d.ts');
const sourceTestFile = path.join(__dirname, 'src', 'mini-inject.test.js');
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

if (!fs.existsSync(sourceTestFile)) {
    console.error('❌ Source test file not found:', sourceTestFile);
    process.exit(1);
}

// Read the source files
const sourceCode = fs.readFileSync(sourceFile, 'utf8');
const sourceTypes = fs.readFileSync(sourceTypesFile, 'utf8');
const sourceTestCode = fs.readFileSync(sourceTestFile, 'utf8');

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

// Generate test files
// For CommonJS test - change import to require and use index.cjs
const cjsTestCode = sourceTestCode
    .replace(
        /import test from ['"]ava['"];?/,
        'const test = require(\'ava\');'
    )
    .replace(
        /import (.+) from ['"]\.\/index\.mjs['"];?/,
        'const $1 = require(\'../index.cjs\');'
    );

// For ES Module test - use index.mjs import
const esmTestCode = sourceTestCode.replace(
    /import (.+) from ['"]\.\/index\.mjs['"];?/,
    'import $1 from \'../index.mjs\';'
);

try {
    // Ensure test directory exists
    const testDir = path.join(distDir, 'test');
    if (!fs.existsSync(testDir)) {
        fs.mkdirSync(testDir, { recursive: true });
    }

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

    // Write test files
    fs.writeFileSync(path.join(distDir, 'test', 'index.test.cjs'), cjsTestCode);
    console.log('✅ Generated test/index.test.cjs (CommonJS test)');
    
    fs.writeFileSync(path.join(distDir, 'test', 'index.test.mjs'), esmTestCode);
    console.log('✅ Generated test/index.test.mjs (ES Module test)');
    
    console.log('\n🎉 Build completed successfully!');
    console.log('📦 Ready for npm publish with files:');
    console.log('   - index.js, index.cjs, index.mjs (JavaScript)');
    console.log('   - index.d.ts, index.d.mts (TypeScript definitions)');
    console.log('   - test/index.test.cjs, test/index.test.mjs (Test files)'); 
    console.log('   - package.json, README.md, LICENSE');
    
} catch (error) {
    console.error('❌ Build failed:', error.message);
    process.exit(1);
}

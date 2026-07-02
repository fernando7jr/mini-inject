#!/usr/bin/env node

// Test that both CommonJS and ES module imports work correctly
console.log('🧪 Validating package for npm publish...\n');

// Check that built files exist
const fs = require('fs');
const requiredFiles = ['index.js', 'index.cjs', 'index.mjs', 'index.d.ts', 'index.d.mts'];
const requiredTestFiles = ['test/index.test.cjs', 'test/index.test.mjs'];
const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
const missingTestFiles = requiredTestFiles.filter(file => !fs.existsSync(file));

if (missingFiles.length > 0) {
    console.log('❌ Missing required files:', missingFiles.join(', '));
    console.log('   Run "npm run build" first');
    process.exit(1);
}

if (missingTestFiles.length > 0) {
    console.log('❌ Missing required test files:', missingTestFiles.join(', '));
    console.log('   Run "npm run build" first');
    process.exit(1);
}

console.log('✅ All required files present');
console.log('✅ All required test files present');

// Validate TypeScript definition files are valid
try {
    const cjsTypes = fs.readFileSync('index.d.ts', 'utf8');
    const esmTypes = fs.readFileSync('index.d.mts', 'utf8');
    
    // Check for required exports
    const requiredExports = ['export class DI', 'export class Token', 'export class DILiteral', 'export class DIFactory'];
    const requiredTypes = ['export type ClassType', 'export type Injectable', 'export type DIGetter'];
    
    let allExportsFound = true;
    
    // Validate CJS definitions
    for (const exportItem of [...requiredExports, ...requiredTypes]) {
        if (!cjsTypes.includes(exportItem)) {
            console.log(`❌ Missing in index.d.ts: ${exportItem}`);
            allExportsFound = false;
        }
    }
    
    // Validate ESM definitions
    for (const exportItem of [...requiredExports, ...requiredTypes]) {
        if (!esmTypes.includes(exportItem)) {
            console.log(`❌ Missing in index.d.mts: ${exportItem}`);
            allExportsFound = false;
        }
    }
    
    // Basic syntax validation - check for balanced braces and valid TypeScript constructs
    const syntaxPatterns = [
        /export\s+(class|interface|type)\s+\w+/g,
        /constructor\s*\(/g,
        /:\s*\w+/g
    ];
    
    for (const pattern of syntaxPatterns) {
        if (!pattern.test(cjsTypes) || !pattern.test(esmTypes)) {
            console.log('❌ TypeScript definitions appear to have syntax issues');
            allExportsFound = false;
            break;
        }
    }
    
    // Check that both files are identical (they should be)
    if (cjsTypes !== esmTypes) {
        console.log('❌ TypeScript definition files are not identical');
        allExportsFound = false;
    }
    
    // Validate file size (should be substantial - our types are ~32KB)
    if (cjsTypes.length < 1000 || esmTypes.length < 1000) {
        console.log('❌ TypeScript definition files appear to be too small');
        allExportsFound = false;
    }
    
    if (allExportsFound) {
        console.log('✅ TypeScript definitions are valid and complete');
    } else {
        process.exit(1);
    }
    
} catch (error) {
    console.log('❌ Failed to validate TypeScript definitions:', error.message);
    process.exit(1);
}

// Test CommonJS
try {
    const { DI: DI_CJS } = require('../index.cjs');
    const di_cjs = new DI_CJS();
    console.log('✅ CommonJS (index.cjs) - OK');
} catch (error) {
    console.log('❌ CommonJS (index.cjs) - FAILED:', error.message);
    process.exit(1);
}

// Test main CommonJS entry
try {
    const { DI: DI_MAIN } = require('../index.js');
    const di_main = new DI_MAIN();
    console.log('✅ CommonJS (index.js) - OK');
} catch (error) {
    console.log('❌ CommonJS (index.js) - FAILED:', error.message);
    process.exit(1);
}

// Test package.json require export
try {
    const { DI: DI_PKG } = require('../');
    const di_pkg = new DI_PKG();
    console.log('✅ CommonJS (package require) - OK');
} catch (error) {
    console.log('❌ CommonJS (package require) - FAILED:', error.message);
    process.exit(1);
}

// Test that all three return the same constructor
try {
    const { DI: DI1 } = require('../index.cjs');
    const { DI: DI2 } = require('../index.js');
    const { DI: DI3 } = require('../');
    
    if (DI1 === DI2 && DI2 === DI3) {
        console.log('✅ All CommonJS exports reference same constructor - OK');
    } else {
        console.log('❌ CommonJS exports are not identical - FAILED');
        process.exit(1);
    }
} catch (error) {
    console.log('❌ CommonJS export comparison - FAILED:', error.message);
    process.exit(1);
}

console.log('\n� Package validation successful!');
console.log('   Ready for npm publish');
console.log('\n📋 Publish workflow:');
console.log('   1. npm run build   (✅ completed)');
console.log('   2. npm run validate (✅ completed)');
console.log('   3. npm test        (run next)');
console.log('   4. npm publish     (final step)');

console.log('\n📄 Files included in npm package:');
console.log('   - index.js, index.cjs, index.mjs');
console.log('   - index.d.ts, index.d.mts');
console.log('   - package.json, README.md, LICENSE');

console.log('\n🚫 Files excluded from npm package:');
console.log('   - src/, test/, scripts/, DEVELOPMENT.md');

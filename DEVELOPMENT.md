# Development Setup

This project uses a single-source approach to maintain both CommonJS and ES Module compatibility without code duplication.

## Project Structure

```
mini-inject/
├── src/
│   ├── mini-inject.js          # Single source file (ES modules format)
│   ├── mini-inject.d.ts        # Single TypeScript definitions source
│   └── mini-inject.test.js     # Single test source file
├── test/                       # Generated test files
│   ├── index.test.cjs          # Generated: CommonJS tests
│   └── index.test.mjs          # Generated: ES modules tests
├── build.js                    # Build script to generate CJS/ESM variants
├── validate.js                 # Package validation script
├── DEVELOPMENT.md              # This file (dev-only)
├── index.js                    # Generated: CJS wrapper
├── index.cjs                   # Generated: CommonJS version
├── index.mjs                   # Generated: ES modules version
├── index.d.ts                  # Generated: TypeScript definitions for CJS
├── index.d.mts                 # Generated: TypeScript definitions for ESM
└── package.json
```

## Development Workflow

1. **Edit source**: Make changes to `src/mini-inject.js`, `src/mini-inject.d.ts`, and `src/mini-inject.test.js`
2. **Build**: Run `npm run build` to generate all module variants and test files
3. **Validate**: Run `npm run validate` to check package integrity, TypeScript definitions, and test files
4. **Test**: Run `npm test` to ensure both CJS and ESM work correctly
5. **Clean**: Run `npm run clean` to remove generated files and test directory (optional)

## Publishing Workflow

When you're ready to publish a new version:

```bash
# The prepublishOnly script automatically runs:
npm publish

# Which executes:
# 1. npm run build    - Generate dist files
# 2. npm run validate - Check package integrity and TypeScript definitions
# 3. npm test        - Run full test suite
# 4. Actual publish  - Upload to npm
```

## Build Process

The `build.js` script:

- Reads `src/mini-inject.js` (written in ES modules format)
- Reads `src/mini-inject.d.ts` (TypeScript definitions)
- Reads `src/mini-inject.test.js` (test source file)
- Generates `index.cjs` by replacing `export` with `module.exports`
- Copies to `index.mjs` unchanged (already ESM)
- Creates `index.js` as a CJS wrapper
- Generates `index.d.ts` and `index.d.mts` (TypeScript definitions for both formats)
- Generates `test/index.test.cjs` with CommonJS imports and `require('../index.cjs')`
- Generates `test/index.test.mjs` with ES module imports and `import from '../index.mjs'`

## NPM Package Contents

**📦 Files included in npm package:**

- `index.js`, `index.cjs`, `index.mjs` (built files)
- `index.d.ts`, `index.d.mts` (TypeScript definitions)
- `package.json`, `README.md`, `LICENSE`

**🚫 Files excluded from npm package:**

- `src/` directory (source files)
- `test/` directory (generated test files)
- `build.js`, `validate.js` (build tools)
- `DEVELOPMENT.md` (this file)
- `.git*` files (version control)

## Benefits

- ✅ **No code duplication** - single source of truth
- ✅ **Automatic builds** - generate on publish
- ✅ **Full compatibility** - works with require() and import
- ✅ **Type safety** - TypeScript definitions for both formats
- ✅ **Zero dependencies** - simple Node.js build script
- ✅ **Clean npm package** - only necessary files published

## Adding Features

When adding new features:

1. Edit `src/mini-inject.js` (implementation)
2. Edit `src/mini-inject.d.ts` (TypeScript definitions)
3. Add to the export statement at the bottom of the JS file
4. Update tests in `src/mini-inject.test.js` if needed
5. Run `npm run build` to generate all distribution and test files
6. Run `npm run validate` and `npm test`

## Available Scripts

- `npm run build` - Generate all distribution files and test files from source
- `npm run clean` - Remove all generated files and test directory
- `npm run validate` - Validate package integrity, TypeScript definitions, and test files
- `npm test` - Run full test suite (both CommonJS and ES module tests)
- `npm run prepublishOnly` - Complete publish workflow (build → validate → test)

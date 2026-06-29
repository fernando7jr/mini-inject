#!/usr/bin/env node
import {pathToFileURL} from 'url';
import {resolve} from 'path';

// ─── Argument parsing ─────────────────────────────────────────────────────────

const rawArgs = process.argv.slice(2);
const [command, filePath, ...rest] = rawArgs;

if (command !== 'analyze' || !filePath) {
    console.error(
        'Usage: mini-inject analyze <file> [--format=text|json] [--export=<name>] [--no-header]',
    );
    process.exit(1);
}

const flags = Object.fromEntries(
    rest
        .filter((a) => a.startsWith('--'))
        .map((a) => {
            const eq = a.indexOf('=');
            if (eq === -1) return [a.slice(2), true];
            return [a.slice(2, eq), a.slice(eq + 1)];
        }),
);

const format = flags.format || 'text';
const exportName = flags.export || null;
const header = !flags['no-header'];

if (format !== 'text' && format !== 'json') {
    console.error(`Unknown format "${format}". Use --format=text or --format=json.`);
    process.exit(1);
}

// ─── Load the user module ─────────────────────────────────────────────────────

const absolutePath = resolve(process.cwd(), filePath);
const fileUrl = pathToFileURL(absolutePath).href;

let mod;
try {
    mod = await import(fileUrl);
} catch (err) {
    console.error(`Failed to import "${filePath}": ${err.message}`);
    process.exit(1);
}

// ─── Locate the DI instance ───────────────────────────────────────────────────

function isDI(obj) {
    return (
        obj != null &&
        typeof obj === 'object' &&
        typeof obj.getDependencyGraph === 'function' &&
        typeof obj.formatDependencyGraph === 'function'
    );
}

function findInObject(obj) {
    if (!obj || typeof obj !== 'object') return null;
    for (const value of Object.values(obj)) {
        if (isDI(value)) return value;
    }
    return null;
}

let di = null;

if (exportName) {
    // Explicit --export=name: check named exports, then default's properties
    const candidate = mod[exportName] ?? (mod.default ? mod.default[exportName] : undefined);
    if (!isDI(candidate)) {
        console.error(`Export "${exportName}" is not a DI instance or was not found.`);
        process.exit(1);
    }
    di = candidate;
} else if (isDI(mod.default)) {
    // ESM `export default di` or CJS `module.exports = di`
    di = mod.default;
} else {
    // Scan named exports
    di = findInObject(mod);
    // Fallback: scan properties of the default export (e.g. CJS `module.exports = { di }`)
    if (!di) di = findInObject(mod.default);
}

if (!di) {
    console.error(
        'No DI instance found in the exported module.\n' +
        'Use --export=<name> to specify the export name, or ensure your file exports a DI instance.',
    );
    process.exit(1);
}

// ─── Output ───────────────────────────────────────────────────────────────────

if (format === 'json') {
    const graph = di.getDependencyGraph();
    process.stdout.write(JSON.stringify(graph, null, 2) + '\n');
} else {
    process.stdout.write(di.formatDependencyGraph({header}) + '\n');
}

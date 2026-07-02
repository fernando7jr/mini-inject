# Dependency Graph Analyzer

`mini-inject` includes a dependency graph analyzer to inspect registered bindings, detect circular references statically, and optimize container configurations.

## Programmatic API

You can generate a serializable graph object or render a human-readable text report:

```javascript
const {DI} = require('mini-inject');

class AuthService {}
class UserService {}
class OrderService {}

const di = new DI();
di.bind(AuthService, []);
di.bind(UserService, [AuthService]);
di.bind(OrderService, [UserService, AuthService]);

// 1. Get serializable graph data
const graph = di.getDependencyGraph();
// Returns: { nodes: [...], edges: [...], cycles: [] }
console.log(JSON.stringify(graph, null, 2));

// 2. Format as a clean text report
console.log(di.formatDependencyGraph());
```

Output text report:
```text
mini-inject dependency graph — 3 binding(s), 0 cycle(s)
=======================================================

AuthService           [singleton]
UserService           [singleton]               AuthService
OrderService          [singleton]               UserService, AuthService
```

### Static API Variants

You can also use static methods to generate or format graphs:
```javascript
const graph = DI.getDependencyGraph(di);
const textReport = DI.formatDependencyGraph(graph, { header: false });
```

---

## Command Line Interface (CLI)

You can run the analyzer CLI command directly on files that export a `DI` instance.

```bash
npx mini-inject analyze <path-to-file>
```

The targets should export the `DI` instance as default export (`export default di` / `module.exports = di`) or a named export.

### CLI Options

| Option | Description |
|---|---|
| `--format=<text\|json>` | Selects report formatting. Defaults to `text`. |
| `--no-header` | Suppresses summary titles and cycle blocks from text output. |
| `--export=<name>` | Picks a specific named export from the file if multiple exist. |

Example:
```bash
npx mini-inject analyze ./src/container.js --no-header
```

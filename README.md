# mini-inject
[![npm version](https://badge.fury.io/js/mini-inject.svg?cache_bypass=true)](https://badge.fury.io/js/mini-inject)
![node test and build workflow](https://github.com/fernando7jr/mini-inject/actions/workflows/node.js.yml/badge.svg)
[![contributions welcome](https://img.shields.io/badge/contributions-welcome-brightgreen.svg?style=flat)](https://github.com/dwyl/esta/issues)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Ffernando7jr%2Fmini-inject.svg?type=shield&issueType=license)](https://app.fossa.com/projects/git%2Bgithub.com%2Ffernando7jr%2Fmini-inject?ref=badge_shield&issueType=license)
[![FOSSA Status](https://app.fossa.com/api/projects/git%2Bgithub.com%2Ffernando7jr%2Fmini-inject.svg?type=shield&issueType=security)](https://app.fossa.com/projects/git%2Bgithub.com%2Ffernando7jr%2Fmini-inject?ref=badge_shield&issueType=security)

Minimalistic dependency injection implementation without decorators (about 200kb after installing)

MiniInject is offered as both CommonJS and ESModule files and there are no dependencies except for testing

The goal is to offer dependency injection as complete as possible with the most simple code that anyone can read

Everything runs synchronously and no need to add a bunch of decorators everywhere. It works as intended and there is no black-box or magic

Please refer to the [documentation](https://fernando7jr.github.io/mini-inject/) or follow this readme.

## Installation

MiniInject is available as the [package mini-inject](https://www.npmjs.com/package/mini-inject).

`npm i mini-inject`

The package provides both cjs and mjs files along the type definitions.

There is no need to install any type definition package, we provide all type declarations on `.d.ts` files and all public methods are documented with examples

## Support

I am actively working on this project.

Use the github page for opening issues or discussions.

## Full Documentation

**Please refer to the [complete documentation](https://fernando7jr.github.io/mini-inject/)** for detailed guides on all features, including Circular Dependencies, Sub-Modules, Scoped Containers (Forks), Tokens, and more.

## Usage and examples

Below is a quick example of the main use cases for binding and resolving dependencies.

```javascript
const {DI} = require('mini-inject');
// Or use the mjs file:
// import {DI} from 'mini-inject';

class A {
    constructor(value) {
        this.value = value;
    }
}

class B {
    value = 'B';
}

class C {
    constructor (a, b) {
        this.a = a;
        this.b = b;
    }
}

const di = new DI();

// Bind the classes A, B and C assigning a function for instantiation
di
    .bind(A, (di) => new A(0))                       // A is a singleton dependency
    .bind(B, (di) => new B(), {isSingleton: false})  // B is not a singleton dependency
    .bind(C, (di) => new C(di.get(A), di.get(B)));   // C is a singleton dependency

// Or let `mini-inject` generate the binding function from an array of dependencies
di
    .bind(A, [di.literal(0)])          // Literal dependencies
    .bind(B, [], {isSingleton: false}) // Not a singleton
    .bind(C, [A, B]);                  // Dependencies resolved automatically

// Retrieve dependencies
const a = di.get(A);
console.log(a.value); // 0
a.value = 10;

const c = di.get(C);
console.log(c.a.value); // 10
console.log(c.b.value); // B

// You can also fetch everything in a single call
const [a2, b2, c2] = di.getAll(A, B, C);

// We also offer a global level DI container which is accessible directly via the DI class (an instance is not necessary!)
DI.bind(A, [DI.literal(0)])

const a = DI.get(A); // 0

// The global level DI can also be isolated with the method runInContext
DI.runInContext(() => {
    DI.bind(B, [DI.literal(1)]);
    const b = DI.get(B);
})
```

### Circular Dependencies

`mini-inject` can automatically detect and resolve circular dependencies using transparent lazy Proxies.

```javascript
// Enable automatic resolution for the whole app
DI.autoResolveCircularDependencies(true);

class ServiceA { constructor(b) { this.b = b; } }
class ServiceB { constructor(a) { this.a = a; } }

const di = new DI();
di.bind(ServiceA, [ServiceB]);
di.bind(ServiceB, [ServiceA]); 

const a = di.get(ServiceA); // Works seamlessly!
```

Or manually use the flag `lateResolve: true` when binding to tag containers that should be lazily resolved.

```javascript
class ServiceA { constructor(b) { this.b = b; } }
class ServiceB { constructor(a) { this.a = a; } }
class ServiceC { constructor(a, b) { this.a = a; this.b = b; } }

const di = new DI();
di.bind(ServiceA, [ServiceB], {lateResolve: true});
di.bind(ServiceB, [ServiceA], {lateResolve: true});
di.bind(ServiceC, [ServiceA, ServiceB]);

const [a, b, c] = di.getAll(ServiceA, ServiceB, ServiceC); // Works seamlessly!
```

### Token, Container, Literal and Factory

You can inject plain values (`literal`), dynamic functions (`factory`), guarantee unique keys (`token`), or group multiple items under one key (`container`).

```javascript
const urlToken = di.token('DatabaseURL');
const plugins = di.container('Plugins'); // Resolves into an array

// Bind a primitive literal
di.bind(urlToken, di.literal('postgres://localhost/db'));

// Bind multiple items to the same container
di.bind(plugins, di.factory(() => new CustomPlugin()));
di.bind(plugins, [StandardPlugin]);

const url = di.get(urlToken); // 'postgres://localhost/db'
const allPlugins = di.get(plugins); // [CustomPlugin, StandardPlugin]
```

### Sub-module and Fork

Organize your DI tree with sub-modules, or create scoped modules (like per-request scopes in servers) using forks.

```javascript
const appDI = new DI();
appDI.bind(Database, []);

// Sub-modules allow composing multiple DI instances together
const authModule = new DI();
authModule.bind(AuthService, []);
appDI.subModule(authModule);

// Fork creates an isolated scope that still shares parent singletons
const requestDI = appDI.fork();
requestDI.bind(CurrentUser, [di.literal('User 123')]);

requestDI.get(Database); // Returns the shared Database from appDI
requestDI.get(AuthService); // Resolves from the attached sub-module
```

For more advanced programmatic use cases, please see the [documentation site](https://fernando7jr.github.io/mini-inject/).

## Dependency Graph Analyzer

`mini-inject` can generate a dependency graph for any DI module so you can understand the full dependency tree, spot potential optimizations, and detect circular dependencies before they cause problems at runtime.

### CLI Usage

The easiest way to analyze your DI containers is using the CLI.

```bash
npx mini-inject analyze <path-to-file>
```

The file must export a `DI` instance — either as `export default di` (ESM), `module.exports = di` (CJS), or as a named export.

**Examples:**

```bash
# Default: text format with header
npx mini-inject analyze ./src/container.js

# JSON output (pipe-friendly)
npx mini-inject analyze ./src/container.js --format=json

# Plain rows, no title or cycles summary
npx mini-inject analyze ./src/container.js --no-header

# When multiple DI instances are exported, pick one by name
npx mini-inject analyze ./src/container.js --export=appDI
```

### Programmatic API

You can also generate and print the graph from code using `di.getDependencyGraph()` and `di.formatDependencyGraph()`:

```javascript
const {DI} = require('mini-inject');
const di = new DI();
// ... (your bindings) ...

// Print a formatted text report
console.log(di.formatDependencyGraph());
```

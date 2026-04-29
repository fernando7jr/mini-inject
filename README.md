# mini-inject
Minimalistic dependency injection implementation without decorators (less than 100kb after installing)

MiniInject is offered as both CommonJS and ESModule files and there are no dependencies except for testing

The goal is to offer dependency injection as complete as possible with the most simple code that anyone can read

Everything runs synchronously and no need to add a bunch of decorators everywhere. It works as intended and there is no blackbox or magic

## Installation

MiniInject is available as the [package mini-inject](https://www.npmjs.com/package/mini-inject).

`npm i mini-inject`

The package provides both cjs and mjs files along the type definitions.

There is no need to install any type definition package, we provide all type declartions on `.d.ts` files and all public methods are documented with examples

## Support

I am activaly working on this project.

Use the github page for opening issues or discussions.

## Usage and examples

```javascript
const {DI} = require('mini-inject');
//or use the mjs file. We provide .js, .cjs and .mjs extensions
import {DI} from 'mini-inject';

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
// Bind the classes A, B and C assigning a function for instanciation
di
    .bind(A, (di) => new A(0))                       // A is a singleton dependency
    .bind(B, (di) => new B(), {isSingleton: false}) // B is not a singleton dependency
    .bind(C, (di) => new C(di.get(A), di.get(B)));  // C is a singleton dependency
// Or let `mini-inject` generate the binding function from an array of dependencies
di
    .bind(A, [di.literal(0)])          // A is a singleton dependency. The param 0 is not a injectable dependency, so we set it as a literal
    .bind(B, [], {isSingleton: false}) // B is not a singleton dependency
    .bind(C, [A, B]);                  // C is a singleton dependency. Both A and B have bindings, so `mini-inject` will resolve it automatically

const a = di.get(A);
console.log(a.value); // 0
a.value = 10;

const c = di.get(C);
console.log(c.a.value); // 10
console.log(c.b.value); // B
c.b.value = 'BB';

const b = di.get(B);
console.log(b.value);   // B
console.log(c.b.value); // BB

// You can also fetch everythin in a single call
const [a2, b2, c2] = di.getAll(A, B, C);
console.log(a2.value); // 0
console.log(b2.value);   // B
console.log(c2.a.value); // 10
console.log(c2.b.value); // B

class D {}
try {
    const d = di.get(D); // There is no binding for D, this will thrown an exception
} catch(err) {
    console.error(err); // Error: No binding for injectable "D"
}
let d = di.get(D, 1);     // There is no binding for D, but since we provided a fallback no exception is thrown
console.log(d);           // 1
d = di.get(D, undefined); // The fallback can be anything even undefined as long as it is in the arguments list
console.log(d);           // undefined

// Circular Dependency
/// Solved through lateResolve param
class A1 {
    constructor(n, a2) {
        this.n = n;
        this.a2 = a2;
    }

    get value() {
        return this.n + this.a2.n;
    }
}

class A2 {
    constructor(n, a1) {
        this.n = n;
        this.a1 = a1; // a1 is a Proxy, as long as no property is used inside the constructor there is no circular dependency problem
    }

    get value() {
        return this.a1.n - this.n;
    }
}

di.bind(A1, [di.literal(5), A2], {lateResolve: true});
di.bind(A2, [di.literal(2), A1]); // A2 will receive a late resolver for A1

const a1 = di.get(A1); // Does not cause stack-overflow
const a2 = di.get(A2); // Does not cause stack-overflow
console.log(a1.value); // 7
console.log(a2.value); // 3


/// Solved automatically — no lateResolve flags needed
// Call once at app startup, or per-instance with di.autoResolveCircularDependencies(true)
DI.autoResolveCircularDependencies(true);

const di2 = new DI();
di2.bind(A1, (di) => new A1(5, di.get(A2)));
di2.bind(A2, (di) => new A2(2, di.get(A1))); // cycle detected at runtime; Proxy created only for the caught binding

const a1 = di2.get(A1); // Does not cause stack-overflow
const a2 = di2.get(A2); // Does not cause stack-overflow
console.log(a1.value); // 7
console.log(a2.value); // 3

DI.autoResolveCircularDependencies(false); // restore default


/// Neither strategy used — descriptive error thrown
const di3 = new DI();
di3.bind(A1, (di) => new A1(5, di.get(A2)));
di3.bind(A2, (di) => new A2(2, di.get(A1)));

try {
    di3.get(A1); // throws immediately
} catch (err) {
    console.error(err.message);
    // Circular dependency detected: A1 → A2 → A1.
    // Use "lateResolve: true" on one of the bindings or enable
    // "autoResolveCircularDependencies" to resolve it automatically.
}


/// Solved through getResolver
class B1 {
    constructor(n, b2) {
        this.n = n;
        this.b2 = b2;
    }

    get value() {
        return this.n + this.b2.n;
    }
}

class B2 {
    /** @type {import('./index').DIResolver<A1>} */
    b1 = null;

    constructor(n, b1) {
        this.n = n;
        this.b1 = b1;
    }

    get value() {
        return this.b1.get().n - this.n;
    }
}

di.bind(B1, [DI.literal(5), B2]);
di.bind(B2, [di.literal(2), di.literal(di.getResolver(B1))]); // A2 will receive a late resolver for A1

const b1 = di.get(B1); // Does not cause stack-overflow
const b2 = di.get(B2); // Does not cause stack-overflow
console.log(b1.value); // 7
console.log(b2.value); // 3

// You can use factory functions instead of plain literals
di.bind(B1, [DI.factory(() => 5), B2]);
di.bind(B2, [di.factory(() => 2), di.factory((_di) => _di.getResolver(B1))]); // A2 will receive a late resolver for A1

const b1 = di.get(B1); // Does not cause stack-overflow
const b2 = di.get(B2); // Does not cause stack-overflow
console.log(b1.value); // 7
console.log(b2.value); // 3
```

### Automatic Circular Dependency Resolution

`mini-inject` can automatically detect and resolve circular dependencies at runtime without requiring any `lateResolve` flags on your bindings.

There are three ways circular dependencies are handled, applied in this priority order:

| Priority | Strategy | Behaviour |
|---|---|---|
| 1 | `DI.autoResolveCircularDependencies(true)` | All instances auto-detect cycles. `lateResolve` flags are ignored. |
| 2 | `instance.autoResolveCircularDependencies(true)` | Only this instance auto-detects cycles. Other instances are unaffected. |
| 3 | `lateResolve: true` on a binding | Manual opt-in; a Proxy is always created for that binding. |
| — | Neither | A descriptive error is thrown listing the full dependency chain. |

When auto mode is active (strategies 1 or 2), a lazy `Proxy` is created **only** for the binding actually caught in the cycle, not every binding involved. The Proxy is transparent — it supports `instanceof`, correct class names in logs/debuggers, and full property access.

```javascript
const {DI} = require('mini-inject');

class ServiceA {
    constructor(b) { this.b = b; }
    greet() { return `A (b is ${this.b.name})`; }
}

class ServiceB {
    constructor(a) { this.a = a; }
    get name() { return 'B'; }
    greet() { return `B (a is ${this.a.greet()})`; }
}

// --- Global flag: affects every DI instance ---
DI.autoResolveCircularDependencies(true);

const di = new DI();
di.bind(ServiceA, (di) => new ServiceA(di.get(ServiceB)));
di.bind(ServiceB, (di) => new ServiceB(di.get(ServiceA)));

const a = di.get(ServiceA);
console.log(a instanceof ServiceA); // true  (Proxy preserves instanceof)
console.log(a.greet());             // A (b is B)

DI.autoResolveCircularDependencies(false); // restore default

// --- Instance flag: affects only this DI instance ---
const di2 = new DI();
di2.autoResolveCircularDependencies(true);
di2.bind(ServiceA, (di) => new ServiceA(di.get(ServiceB)));
di2.bind(ServiceB, (di) => new ServiceB(di.get(ServiceA)));

const a2 = di2.get(ServiceA); // resolves fine

const di3 = new DI(); // auto mode is still off here
di3.bind(ServiceA, (di) => new ServiceA(di.get(ServiceB)));
di3.bind(ServiceB, (di) => new ServiceB(di.get(ServiceA)));

try {
    di3.get(ServiceA); // throws immediately — no lateResolve, no auto mode
} catch (err) {
    console.error(err.message);
    // Circular dependency detected: ServiceA → ServiceB → ServiceA.
    // Use "lateResolve: true" on one of the bindings or enable
    // "autoResolveCircularDependencies" to resolve it automatically.
}
```

### Clearing DI Containers

The `clear()` method allows you to reset a DI instance by clearing all containers, bindings, and sub-modules. This is particularly useful for testing scenarios or when you need to reconfigure the entire dependency injection container.

```javascript
const {DI} = require('mini-inject');

class ServiceA {
    value = 'Service A';
}

class ServiceB {
    constructor(serviceA) {
        this.serviceA = serviceA;
        this.value = 'Service B';
    }
}

const di = new DI();
const subModule = new DI();

// Set up some bindings
di.bind(ServiceA, []);
di.bind(ServiceB, [ServiceA]);
subModule.bind('subService', () => ({ value: 'Sub Service' }));
di.subModule(subModule);

// Verify bindings exist
console.log(di.has(ServiceA));        // true
console.log(di.has(ServiceB));        // true  
console.log(di.has('subService'));    // true
console.log(subModule.has('subService')); // true

// Get instances (singletons will be cached)
const serviceA = di.get(ServiceA);
const serviceB = di.get(ServiceB);
const subService = di.get('subService');

console.log(serviceA.value);    // 'Service A'
console.log(serviceB.value);    // 'Service B'
console.log(subService.value);  // 'Sub Service'

// Clear the main DI container (also clears sub-modules recursively)
di.clear();

// Verify everything is cleared
console.log(di.has(ServiceA));        // false
console.log(di.has(ServiceB));        // false
console.log(di.has('subService'));    // false
console.log(subModule.has('subService')); // false (sub-modules are also cleared)

// DI can be used normally after clearing
di.bind('newService', () => ({ value: 'New Service' }));
console.log(di.has('newService'));    // true
const newService = di.get('newService');
console.log(newService.value);        // 'New Service'
```

### Sub-Modules

`mini-inject` now supports sub-modules for better managing dependencies. A sub-module is just an instance of `DI` class but is used by the parent module for resolving dependencies when the binding does not exist in the parent module.

Dependency resolution works top-down, so first we check the parent module and if the biding does not exists then we check each sub-module in the order they were added.
This means that a sub-module does not access the parent bindings but the parent can get the sub-modules bindings.

```javascript
const {DI} = require('mini-inject');
const di = new DI();

class A {}
class B {}
di.bind(A);
di.bind(B);

class Sub1A {}
class Sub1B {}
const sub1 = new DI();
sub1.bind(Sub1A);
sub1.bind(Sub1B);

class Sub2C {}
class Sub2D {
    constructor (sub1B, a) {
        this.sub1B = sub1B;
        this.a = a;
    }
}
const sub2 = new DI();
sub2.bind(Sub2C);
sub2.bind(Sub2D, [Sub1B, A]);

di.subModule(sub1, sub2);

// Those work fine
di.getAll(A, B, Sub1A, Sub1B, Sub2C); // [A, B, Sub1A, Sub1B, Sub2C]
sub1.getAll(Sub1A, Sub1B);            // [sub1A, Sub1B]
sub2.get(Sub2C);                      // Sub2C

// Those will throw errors.
sub1.get(A);          // sub1 does not have access to A. It throws: Error('No binding for injectable "A"')
sub2.get(A);          // sub2 does not have access to A. It throws: Error('No binding for injectable "A"')
sub2.get(Sub2D);      // sub2 does not have access to Sub1B. It throws: Error('No binding for injectable "Sub1B"')

// The solution is to bind `Sub1B` to sub2 module or just add sub1 as a sub-module of sub2 too
sub2.bind(Sub1B); // or sub2.subModule(sub1);
// The same problem will still happen if a sub-module needs a dependency that is available in the parent but not in the sub-module
sub2.get(Sub2D); // sub2 does not have access to A. It throws: Error('No binding for injectable "A"')
// If we bind `A` to sub2 module then it will work
sub2.bind(A);
sub2.get(Sub2D); // Sub2D
```

### Tokens

The Token is an alternative when the developer wants more control for how the binding keys are generated.
Instead of a plain string or symbol, Tokens can be used along a *"description"* which specifies how the key should be generated and guarantee more uniqueness.

Suppose we have 2 classes of same name exported by different modules:
````javascript
import {C as C1} from './c1';
import {C as C2} from './c2';
````

Attempting to bind both directly to a di module will cause conflict since `C1` and `C2` generates the same key `C`:
````javascript
const di = new DI();
di.bind(C1, []);
di.bind(C2, []);

const [c1, c2] = di.getAll(C1, C2);
console.log(c1 === c2); // prints "true"
````

By using tokens we can solve the problem above. A custom description can be passed for each token so a different key is generated:
````javascript
const di = new DI();
const tokenC1 = di.token(C1, 'C1');
const tokenC2 = di.token(C2, 'C2');

di.bind(C1, []);
di.bind(C2, []);

const [c1, c2] = di.getAll(tokenC1, tokenC2);
console.log(c1 === c2); // prints "false"

// But attempting to retrieve them without the token will not work
// The following will throw an Error
di.get(C1); // Throws 'No binding for injectable "C1"'
di.get('C1'); // Throws 'No binding for injectable "C1"'
di.get(Symbol.for('C1')); // Throws 'No binding for injectable "C1"'
````

Tokens are still usable even without a custom description:
````javascript
class A {}
class B {}

const di = new DI();
const tokenA = di.token(A);
const tokenB = di.token(B);

di.bind(A, []);
di.bind(B, []);

const [a, b] = di.getAll(tokenA, tokenB);
console.log(a === b); // prints "false"

// But attempting to retrieve them without the token will not work
// The following will throw an Error
di.get(A); // Throws 'No binding for injectable "A"'
di.get('A'); // Throws 'No binding for injectable "A"'
di.get(Symbol.for('A')); // Throws 'No binding for injectable "A"'
````

### Dependency Graph Analyzer

`mini-inject` can generate a dependency graph for any DI module so you can understand the full dependency tree, spot potential optimisations, and detect circular dependencies before they cause problems at runtime.

#### Programmatic API

```javascript
const {DI} = require('mini-inject');

class AuthService {}
class UserService {}
class OrderService {}
class NotificationService {}

const di = new DI();
di.bind(AuthService, []);
di.bind(UserService, [AuthService]);
di.bind(OrderService, [UserService, AuthService]);
di.bind(NotificationService, () => new NotificationService()); // custom factory

// Get a serialisable graph object
const graph = di.getDependencyGraph();
// { nodes: [...], edges: [...], cycles: [] }
console.log(JSON.stringify(graph, null, 2));

// Or get a formatted text report (header is shown by default)
console.log(di.formatDependencyGraph());
// mini-inject dependency graph — 4 binding(s), 0 cycle(s)
// ═══════════════════════════════════════════════════════
//
// AuthService           [singleton]
// UserService           [singleton]               AuthService
// OrderService          [singleton]               UserService, AuthService
// NotificationService   [singleton]               (custom initializer - unknown deps)

// Without the header/summary section
console.log(di.formatDependencyGraph({header: false}));

// Static variants accept a pre-computed graph
const graph2 = DI.getDependencyGraph(di);
const text2  = DI.formatDependencyGraph(graph2, {header: false});
```

Circular dependencies are detected and reported without throwing — they are valid when resolved via `lateResolve: true` or `autoResolveCircularDependencies`:

```javascript
class A {}
class B {}

const di = new DI();
di.bind(A, [B]);
di.bind(B, [A], {lateResolve: true});

console.log(di.formatDependencyGraph());
// mini-inject dependency graph — 2 binding(s), 1 cycle(s)
// ══════════════════════════════════════════════════════
//
// A   [singleton]               B  ⚠ CYCLE: A → B → A
// B   [singleton]  lateResolve  A  ⚠ CYCLE: A → B → A
//
// Cycles detected:
//   [1] A → B → A
```

The `nodes` array describes each binding:

| Field | Type | Description |
|---|---|---|
| `key` | `string` | Display name (`"MyClass"`, `"myKey"`, `"Token<desc>"`) |
| `isSingleton` | `boolean` | Whether the binding is a singleton |
| `lateResolve` | `boolean` | Whether `lateResolve: true` is set on this binding |
| `isSubModule` | `boolean` | `true` when the binding comes from an attached sub-module |
| `deps` | `DepDescriptor[] \| null` | Dep list, or `null` when a custom factory function was used |

Each `DepDescriptor` is one of:
- `{ type: 'injectable', key: string }` — another registered injectable
- `{ type: 'literal', value: unknown }` — a `DI.literal(...)` value
- `{ type: 'factory', name: string | null }` — a `DI.factory(...)` function (anonymous when `name` is `null`)

#### CLI

```bash
npx mini-inject analyze <path-to-file>
```

The file must export a `DI` instance — either as `export default di` (ESM), `module.exports = di` (CJS), or as a named export.

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

## Changelog

#### 1.12.0

* Added `di.getDependencyGraph()` / `DI.getDependencyGraph(di)` — returns a serialisable graph object (`{ nodes, edges, cycles }`) describing all registered bindings, their dependency descriptors, directed edges, and any detected circular-dependency cycles
* Added `di.formatDependencyGraph(opts?)` / `DI.formatDependencyGraph(graph, opts?)` — renders a dependency graph as a human-readable text report; pass `{ header: false }` to suppress the title and cycles-summary section
* Added `bin/analyze.mjs` CLI — run `npx mini-inject analyze <file>` to print a dependency report for any module that exports a `DI` instance; supports `--format=text|json`, `--export=<name>`, and `--no-header`
* Dep descriptors distinguish between `injectable` keys, `Literal<value>`, `Factory<name>`, and `null` (custom factory function — deps cannot be statically determined)
* Token keys are displayed as `Token<description>` in all outputs
* Bindings from attached sub-modules are included in the graph and marked with `isSubModule: true`
* New TypeScript types: `DepDescriptor`, `GraphNode`, `GraphEdge`, `DependencyGraph`, `FormatGraphOptions`

#### 1.11.0

* Added `DI.autoResolveCircularDependencies(true/false)` — global static flag that automatically detects and resolves circular dependencies at runtime for all instances, without needing any `lateResolve` flags on bindings
* Added `instance.autoResolveCircularDependencies(true/false)` — per-instance flag with the same behaviour, only affecting that specific `DI` instance. The global flag takes precedence
* When neither auto mode nor `lateResolve` is used and a cycle is encountered, `get()` now throws a descriptive error listing the full dependency chain (e.g. `"Circular dependency detected: A → B → A"`) with instructions on how to fix it
* Updated TypeScript declarations and JSDoc for all affected methods

#### 1.10.1 and 1.10.2

* Improved `getAll` method signatures to use named parameters instead of tuple types
* Fixed TypeScript compatibility with the latest TypeScript versions
* Better type inference for `getAll` calls with 15+ parameters using spread syntax

#### 1.10

* Added the `clear()` method to reset DI containers, bindings, and sub-modules
* The `clear()` method recursively clears all sub-modules to ensure complete cleanup
* Useful for testing scenarios and reconfiguring the entire dependency injection container

#### 1.9

* Added support for Tokens through `di.token` method

#### 1.8

* Added factory for depencies

#### 1.7

* Added sub-modules through the method `subModule`
* Added the method `has` to test if there is a binding for an injectable
* Binding now works without any parameters for constructable classes. Calling just `di.bind(A)` now works as if it were `di.bind(A, [])`

#### 1.6

* Added literals for dependencies

#### 1.5

* Binding with an empty dependency array now automatically set lateResolve flag to `false`
* Added the method `getBinding` for accessing the inner works of the library

# Getting Started

This page covers basic usage, bindings, tokens, container configuration, and container resetting.

## Basic Usage

Here is a quick example of defining dependencies and resolving them:

```javascript
const {DI} = require('mini-inject');
// or using ESM
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

// Bind classes A, B and C by assigning a function for instantiation
di
    .bind(A, (di) => new A(0))                       // A is a singleton dependency
    .bind(B, (di) => new B(), {isSingleton: false}) // B is transient (not a singleton)
    .bind(C, (di) => new C(di.get(A), di.get(B)));  // C is a singleton dependency

// Alternatively, let mini-inject auto-resolve from dependency arrays
di
    .bind(A, [di.literal(0)])          // A singleton with a literal value (0)
    .bind(B, [], {isSingleton: false}) // B transient
    .bind(C, [A, B]);                  // C resolving A and B automatically

const a = di.get(A);
console.log(a.value); // 0
a.value = 10;

const c = di.get(C);
console.log(c.a.value); // 10
console.log(c.b.value); // B

// Fetch multiple dependencies at once
const [a2, b2, c2] = di.getAll(A, B, C);
```

## Handling Missing Bindings

If you try to resolve a class or key that has not been bound, `mini-inject` will throw an error:

```javascript
class D {}
try {
    const d = di.get(D);
} catch(err) {
    console.error(err); // Error: No binding for injectable "D"
}

// You can provide a fallback value to avoid exceptions:
let d = di.get(D, 1);     // Returns 1
d = di.get(D, undefined); // Returns undefined
```

## Tokens

Tokens give you more control over binding keys, allowing you to avoid naming conflicts when different modules export classes with identical names.

```javascript
// Suppose we import two classes of the same name:
import {C as C1} from './c1';
import {C as C2} from './c2';

const di = new DI();
const tokenC1 = di.token(C1, 'C1');
const tokenC2 = di.token(C2, 'C2');

di.bind(tokenC1, []);
di.bind(tokenC2, []);

const [c1, c2] = di.getAll(tokenC1, tokenC2);
console.log(c1 === c2); // false

// Attempting to retrieve them without the token will throw an error:
di.get(C1); // Throws 'No binding for injectable "C1"'
```

## Containers

Containers let you group multiple bindings under a single key. When resolved, the container returns an array containing all its resolved bindings. Each bound element preserves its configuration.

```javascript
class PluginA {}
class PluginB {}
class PluginC {}

const di = new DI();
const plugins = di.container('plugins');

di.bind(PluginA, []);
di.bind(PluginB, []);

// Bind elements to the container:
di.bind(plugins, PluginA, { isSingleton: true });
di.bind(plugins, PluginB, { isSingleton: false });
di.bind(plugins, () => new PluginC(), { isSingleton: true });

// Resolving a container returns an array of all instances:
const list = di.get(plugins);
console.log(list.length); // 3
console.log(list[0] instanceof PluginA); // true
```

The options parameter on `bind()` supports `eager: true`. If `eager` is `true`, `mini-inject` instantiates the singleton immediately instead of lazily.

## Clearing DI Containers

You can reset a DI instance using `clear()`. This clears all bindings, container configurations, caches, and recursively clears sub-modules:

```javascript
const di = new DI();
di.bind(A, []);

console.log(di.has(A)); // true

// Clear container (calls .dispose() on singletons if they implement it)
di.clear();

console.log(di.has(A)); // false
```

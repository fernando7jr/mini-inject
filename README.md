# mini-inject
Minimalistic dependency injection implementation without decorators

## Installation

MiniInject is available as the [package inject](https://www.npmjs.com/package/mini-inject).

`npm i mini-inject`

The package provides both cjs and mjs files along the type definitions.

## Support

I am activaly working on this project. 
Use the github page for opening issues or discussions.

## Usage and examples

```javascript
const {DI} = require('mini-inject');

class A {
    value = 0;
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
    .bind(A, (di) => new A())                       // A is a singleton dependency
    .bind(B, (di) => new B(), {isSingleton: false}) // B is not a singleton dependency
    .bind(C, (di) => new C(di.get(A), di.get(B)));  // C is a singleton dependency
// Or let `mini-inject` generate the binding function from an array of dependencies
di
    .bind(A, [])                       // A is a singleton dependency
    .bind(B, [], {isSingleton: false}) // B is not a singleton dependency
    .bind(C, [A, B]);                  // C is a singleton dependency

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

di.bind(A1, () => new B1(5, di.get(A2)), {lateResolve: true});
di.bind(A2, () => new B2(2, di.get(A1))); // A2 will receive a late resolver for A1

const a1 = di.get(A1); // Does not cause stack-overflow
const a2 = di.get(A2); // Does not cause stack-overflow
console.log(a1.value); // 7
console.log(a2.value); // 3


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

di.bind(B1, () => new B1(5, di.get(B2)));
di.bind(B2, () => new B2(2, di.getResolver(B1))); // A2 will receive a late resolver for A1

const b1 = di.get(B1); // Does not cause stack-overflow
const b2 = di.get(B2); // Does not cause stack-overflow
console.log(b1.value); // 7
console.log(b2.value); // 3
```

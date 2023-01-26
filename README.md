# mini-di
Minimalistic dependency injection implementation without decorators

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
di
    .bind(A, (di) => new A())                       // A is a singleton dependency
    .bind(B, (di) => new B(), {isSingleton: false}) // B is not a singleton dependency
    .bind(C, (di) => new C(di.get(A), di.get(B)));  // C is a singleton dependency

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

class D {}
try {
    const d = di.get(D); // There is no binding for D, this will thrown an exception
} catch(err) {
    console.error(err); // Error: No binding for injectable "D"
}
```

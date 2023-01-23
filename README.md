# mini-di
Minimalistic dependency injection implementation without decorators

## Usage and examples

```javascript
const {DI} = require('mini-inject');

class A {
    value = 0;
};

class B {
    value = 'B';
};

class C {
    constructor (a, b) {
        this.a = a;
        this.b = b;
    }
}

const di = new DI();
di
    .bind(A, (di) => new A())
    .bind(B, (di) => new B())
    .bind(C, (di) => new C(di.get(A), di.get(B)));

const a = di.get(A);
console.log(a.value); // 0
a.value = 10;

const c = di.get(C);
console.log(c.a.value); // 10
console.log(c.b.value); // B

const b = di.get(B);
console.log(b.value); // B
```
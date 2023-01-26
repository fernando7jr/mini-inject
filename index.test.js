const test = require('ava');
const { DI } = require('./index');

const idGen = (function* () {
    let i = 0;
    while (true) {
        yield i++;
    }
})();

class A {
    constructor(value) {
        this.value = value;
        this.id = idGen.next();
    }
}

class B {
    constructor(value) {
        this.value = (value || 1) * 2;
        this.id = idGen.next();
    }
}

class C {
    constructor(a, b) {
        this.a = a;
        this.b = b;
        this.id = idGen.next();
    }

    get value() {
        return this.a.value + this.b.value;
    }
}

test('Singlethon', async (t) => {
    const di = new DI();
    di.bind(A, () => new A(5));
    di.bind(C, (di) => new C(di.get(A), di.get(B)));
    di.bind(B, () => new B(5));

    const { a, b, c } = {
        a: di.get(A),
        b: di.get(B),
        c: di.get(C),
    };

    t.truthy(a);
    t.truthy(b);
    t.truthy(c);
    t.is(a.value, 5);
    t.is(b.value, 10);
    t.is(c.value, 15);

    const c2 = di.get(C);
    t.truthy(c2);
    t.is(a.id, c.a.id);
    t.is(b.id, c.b.id);
    t.is(c.id, c2.id);
});

test('Non-Singlethon', async (t) => {
    const di = new DI();
    di.bind(A, () => new A(5), {isSingleton: false});
    di.bind(C, (di) => new C(di.get(A), di.get(B)), {isSingleton: false});
    di.bind(B, () => new B(5));

    const { a, b, c } = {
        a: di.get(A),
        b: di.get(B),
        c: di.get(C),
    };

    t.truthy(a);
    t.truthy(b);
    t.truthy(c);
    t.is(a.value, 5);
    t.is(b.value, 10);
    t.is(c.value, 15);

    const c2 = di.get(C);
    t.truthy(c2);
    t.not(a.id, c.a.id);
    t.is(b.id, c.b.id);
    t.not(c.id, c2.id);
});

test('Should throw when can not find a binding', (t) => {
    const di = new DI();
    di.bind(A, () => new A(5), {isSingleton: false});
    di.bind(C, (di) => new C(di.get(A), di.get(B)), {isSingleton: false});

    t.notThrows(() => di.get(A));
    t.throws(() => di.get(C), {message: 'No binding for injectable "B"'});
    t.throws(() => di.get(B), {message: 'No binding for injectable "B"'});
});

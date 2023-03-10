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
    /** @type {import('./index').DIResolver<A1>} */
    a1 = null;

    constructor(n, a1) {
        this.n = n;
        this.a1 = a1;
    }

    get value() {
        return this.a1.get().n - this.n;
    }
}

test('Should bind as Singlethon', async (t) => {
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

test('Should bind as Non-Singlethon', async (t) => {
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

test('Should accept symbols for binding', (t) => {
    const symbolA = Symbol('A');
    const symbolB = Symbol('B');
    const symbolC = Symbol('C');

    const di = new DI();
    di.bind(symbolA, () => new A(5));
    di.bind(symbolB, () => new B(5));
    di.bind(symbolC, (di) => new C(di.get(symbolA), di.get(symbolB)));

    t.notThrows(() => di.get(symbolA));
    t.notThrows(() => di.get(symbolB));
    t.notThrows(() => di.get(symbolC));

    const { a, b, c } = {
        a: di.get(symbolA),
        b: di.get(symbolB),
        c: di.get(symbolC),
    };

    t.truthy(a instanceof A);
    t.truthy(b instanceof B);
    t.truthy(c instanceof C);
});

test('Should solve the circular dependency problem through "getResolver"', (t) => {
    const di = new DI();
    di.bind(A1, () => new A1(5, di.get(A2)));
    di.bind(A2, () => new A2(2, di.getResolver(A1)));

    const a1 = di.get(A1);
    const a2 = di.get(A2);

    t.truthy(a1);
    t.truthy(a2);
    t.is(a1.value, 7);
    t.is(a2.value, 3);
});

test('Should throw when can not find a binding', (t) => {
    const di = new DI();
    di.bind(A, () => new A(5), {isSingleton: false});
    di.bind(C, (di) => new C(di.get(A), di.get(B)), {isSingleton: false});

    t.notThrows(() => di.get(A));
    t.throws(() => di.get(C), {message: 'No binding for injectable "B"'});
    t.throws(() => di.get(B), {message: 'No binding for injectable "B"'});
    t.throws(() => di.get('TEST'), {message: 'No binding for injectable "TEST"'});
    t.throws(() => di.get(Symbol("B")), {message: 'No binding for injectable "Symbol(B)"'});
});

test('Should solve the circular dependency problem through "lateResolve"', (t) => {
    const A2 = class {
        constructor(n, a1) {
            this.n = n;
            this.a1 = a1;
        }
    
        get value() {
            return this.a1.n - this.n;
        }
    }

    const di = new DI();
    di.bind(A1, () => new A1(5, di.get(A2)), {lateResolve: true});
    di.bind(A2, () => new A2(2, di.get(A1)));

    const a1 = di.get(A1);
    const a2 = di.get(A2);

    t.truthy(a1);
    t.truthy(a2);
    t.is(a1.value, 7);
    t.is(a2.value, 3);
});

test('Should auto bind using dependencies list', async (t) => {
    const di = new DI();
    di.bind(A, () => new A(5));
    di.bind(B, () => new B(5));
    di.bind(C, [A, B]);

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
});

test('Should throw when binding string using dependencies list', (t) => {
    const di = new DI();
    di.bind(A, () => new A(5));
    di.bind(B, () => new B(5));
    t.throws(() => di.bind('C', [A, B]), {message: 'Array of dependencies requires a constructable injectable'});
});

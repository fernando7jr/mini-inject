import test from 'ava';
import {DI} from './index.mjs';

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

class D {}

test('Should bind as Singlethon', async (t) => {
    const di = new DI();
    di.bind(A, () => new A(5));
    di.bind(C, (di) => new C(di.get(A), di.get(B)));
    di.bind(B, () => new B(5));

    const {a, b, c} = {
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

    const {a, b, c} = {
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

    const {a, b, c} = {
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
    // Using function to isntanciate the classes
    {
        di.bind(A1, () => new A1(5, di.get(A2)));
        di.bind(A2, () => new A2(2, di.getResolver(A1)));

        const a1 = di.get(A1);
        const a2 = di.get(A2);

        t.truthy(a1);
        t.truthy(a2);
        t.is(a1.value, 7);
        t.is(a2.value, 3);
    }

    // Using dependencies array
    {
        di.bind(A1, [di.literal(8), A2]);
        di.bind(A2, [di.literal(1), di.literal(di.getResolver(A1))]);

        const a1 = di.get(A1);
        const a2 = di.get(A2);

        t.truthy(a1);
        t.truthy(a2);
        t.is(a1.value, 9);
        t.is(a2.value, 7);
    }
});

test('Should throw when can not find a binding', (t) => {
    const di = new DI();
    di.bind(A, () => new A(5), {isSingleton: false});
    di.bind(C, (di) => new C(di.get(A), di.get(B)), {isSingleton: false});

    t.notThrows(() => di.get(A));
    t.throws(() => di.get(C), {message: 'No binding for injectable "B"'});
    t.throws(() => di.get(B), {message: 'No binding for injectable "B"'});
    t.throws(() => di.get('TEST'), {
        message: 'No binding for injectable "TEST"',
    });
    t.throws(() => di.get(Symbol('B')), {
        message: 'No binding for injectable "Symbol(B)"',
    });
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
    };

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

    const {a, b, c} = {
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
    t.throws(() => di.bind('C', [A, B]), {
        message: 'Array of dependencies requires a constructable injectable',
    });
});

test('Should be able to bind a class without a dependencies list parameter', (t) => {
    const di = new DI();
    di.bind(D);
    const d = di.get(D);
    t.truthy(d);
});

test('Should throw when binding string using an undefined dependencies list', (t) => {
    const di = new DI();
    t.throws(() => di.bind('C'), {
        message: 'Array of dependencies requires a constructable injectable',
    });
});

test('Should get all dependencies in a single call', async (t) => {
    const di = new DI();
    di.bind(A, () => new A(5));
    di.bind(B, () => new B(5));
    di.bind(C, [A, B]);

    const [a, b, c] = di.getAll(A, B, C);

    t.truthy(a);
    t.truthy(b);
    t.truthy(c);
    t.is(a.value, 5);
    t.is(b.value, 10);
    t.is(c.value, 15);
});

test('Should use fallback when there is no binding', async (t) => {
    const di = new DI();
    t.throws(() => di.get(A), {message: 'No binding for injectable "A"'});
    const a = di.get(A, null);
    t.is(a, null);

    const bResolver = di.getResolver(B);
    t.throws(() => bResolver.get(), {message: 'No binding for injectable "B"'});
    const b = bResolver.get(undefined);
    t.is(b, undefined);
});

test('Should get the binding for injectables', async (t) => {
    const di = new DI();
    di.bind(A, () => new A(5), {isSingleton: false});
    di.bind(B, () => new B(5));
    di.bind(C, [A, B], {lateResolve: true});

    const testBinding = (binding, compareTo) => {
        t.truthy(binding);
        t.is(binding.isSingleton, compareTo.isSingleton);
        t.is(binding.lateResolve, compareTo.lateResolve);
        t.truthy(binding.resolveFunction);
        t.is(typeof binding.resolveFunction === 'function', true);
    };

    testBinding(di.getBinding(A), {isSingleton: false, lateResolve: false});
    testBinding(di.getBinding(B), {isSingleton: true, lateResolve: false});
    testBinding(di.getBinding(C), {isSingleton: true, lateResolve: true});
    t.is(di.getBinding(A1), undefined);
    t.is(di.getBinding(A2), undefined);
});

test('Should override lateResolve to false when dependencies array is empty', async (t) => {
    const di = new DI();
    di.bind(A, [], {lateResolve: true});

    const binding = di.getBinding(A);
    t.truthy(binding);
    t.is(binding.lateResolve, false);
    t.is(binding.isSingleton, true);
    t.truthy(binding.resolveFunction);
    t.is(typeof binding.resolveFunction === 'function', true);
});

test('Should allow dependencies to be literal values rather than injectables only', async (t) => {
    const di = new DI();

    // Using the class method
    di.bind(A, [DI.literal(5)]);
    di.bind(B, [DI.literal(5)]);

    let [a, b] = di.getAll(A, B);

    t.truthy(a);
    t.truthy(b);
    t.is(a.value, 5);
    t.is(b.value, 10);

    // Using the instance method
    di.bind(A, [di.literal(7)]);
    di.bind(B, [di.literal(7)]);

    [a, b] = di.getAll(A, B);

    t.truthy(a);
    t.truthy(b);
    t.is(a.value, 7);
    t.is(b.value, 14);
});

test('Should correctly use new or apply depending on the injectable type', async (t) => {
    const di = new DI();
    function fB(x) {
        return new B(x);
    }

    di.bind(A, [DI.literal(5)]);
    di.bind(fB, [DI.literal(5)]);

    const [a, b] = di.getAll(A, fB);

    t.truthy(a);
    t.truthy(b);
    t.is(a.value, 5);
    t.is(b.value, 10);
});

test('Should check if a binding exists', async (t) => {
    const di = new DI();
    di.bind(A, [DI.literal(5)]);

    t.is(di.has(A), true);
    t.is(di.has(B), false);
});

test('Should work with sub-modules', async (t) => {
    const sub1 = new DI();
    sub1.bind(A, [DI.literal(5)]);
    const sub2 = new DI();
    sub2.bind(B, [DI.literal(5)]);

    const di = new DI();
    di.bind(C, [A, B]);
    di.subModule(sub1, sub2);

    const [a, b, c] = di.getAll(A, B, C);

    t.truthy(a);
    t.truthy(b);
    t.truthy(c);
    t.is(a.value, 5);
    t.is(b.value, 10);
    t.is(c.value, 15);

    a.value = 20;
    t.is(di.get(A).value, 20);
    t.is(sub1.get(A).value, 20);

    t.is(di.has(A), true);
    t.is(di.has(B), true);
    t.is(di.has(C), true);
    t.is(sub1.has(A), true);
    t.is(sub1.has(B), false);
    t.is(sub1.has(C), false);
    t.is(sub2.has(A), false);
    t.is(sub2.has(B), true);
    t.is(sub2.has(C), false);
});

test('Should not be possible for a sub-module access a parent dependency', async (t) => {
    const sub1 = new DI();
    sub1.bind(A, [DI.literal(5)]);

    const di = new DI();
    di.bind(B, [DI.literal(5)]);
    di.bind(C, [A, B]);
    di.subModule(sub1);

    const a = sub1.get(A);
    t.truthy(a);
    t.is(a.value, 5);

    t.throws(() => sub1.get(B), {
        message: 'No binding for injectable "B"',
    });
});

test('Should not be possible for a sub-module access a dependency from another sub-module with the same parent', async (t) => {
    const sub1 = new DI();
    sub1.bind(A, [DI.literal(5)]);

    const sub2 = new DI();
    sub2.bind(B, [DI.literal(5)]);
    sub2.bind(C, [A, B]);

    const di = new DI();
    di.subModule(sub1, sub2);

    t.throws(() => sub2.get(C), {
        message: 'No binding for injectable "A"',
    });

    t.throws(() => di.get(C), {
        message: 'No binding for injectable "A"',
    });
});

test('Should ensure that a resolved dependency from a sub-module remains in the sub-module', async (t) => {
    const sub1 = new DI();
    sub1.bind(A, [DI.literal(5)]);

    const di = new DI();
    di.bind(B, [DI.literal(5)]);
    di.subModule(sub1);

    let a = sub1.get(A);
    t.truthy(a);
    t.is(a.value, 5);

    a = di.get(A);
    t.truthy(a);
    t.is(a.value, 5);

    a.value = 20;
    t.is(di.get(A).value, 20);
    t.is(sub1.get(A).value, 20);

    di.bind(A, [DI.literal(10)]);
    t.is(di.get(A).value, 10);
    t.is(sub1.get(A).value, 20);
});

test('Should handle factory dependencies', async (t) => {
    const di = new DI();

    // Using the class method
    di.bind(A, [DI.factory(() => 5)]);
    di.bind(B, [DI.factory(() => 5)]);

    let [a, b] = di.getAll(A, B);

    t.truthy(a);
    t.truthy(b);
    t.is(a.value, 5);
    t.is(b.value, 10);

    // Using the instance method
    di.bind(A, [di.factory(() => 7)]);
    di.bind(B, [di.factory(() => 7)]);

    [a, b] = di.getAll(A, B);

    t.truthy(a);
    t.truthy(b);
    t.is(a.value, 7);
    t.is(b.value, 14);

    let n = 1;
    di.bind(A, [di.factory(() => (n++) * 10)]);
    for (let i = 0; i < 10; i += 1) {
        const a = di.get(A);
        t.truthy(a);
        t.is(a.value, 10);
    }

    n = 1;
    di.bind(A, [di.factory(() => (n++) * 10)], {isSingleton: false});
    for (let i = 0; i < 10; i += 1) {
        const a = di.get(A);
        t.truthy(a);
        t.is(a.value, 10 * (i + 1));
    }
});

test('Should accept tokens for binding', async (t) => {
    const di = new DI();

    let tokenA = DI.token(A);
    let tokenB = DI.token(B);
    let tokenC = DI.token('150cc');
    let tokenD = DI.token(class {get value() {return 'DD';} });

    // Using the class method
    di.bind(tokenA, [DI.factory(() => 5)]);
    di.bind(tokenB, [DI.factory(() => 5)]);
    di.bind(tokenC, () => 'C');
    di.bind(tokenD);

    let [a, b, c, d] = di.getAll(tokenA, tokenB, tokenC, tokenD);

    t.truthy(a);
    t.truthy(b);
    t.truthy(c);
    t.truthy(d);
    t.is(a.value, 5);
    t.is(b.value, 10);
    t.is(c, 'C');
    t.is(d.value, 'DD');

    // Using the instance method
    tokenA = di.token(A);
    tokenB = di.token(B);
    tokenC = di.token('150cc');
    tokenD = di.token(class {get value() {return 'DD';} });

    // Using the class method
    di.bind(tokenA, [di.factory(() => 5)]);
    di.bind(tokenB, [di.factory(() => 5)]);
    di.bind(tokenC, () => 'C');
    di.bind(tokenD);

    [a, b, c, d] = di.getAll(tokenA, tokenB, tokenC, tokenD);

    t.truthy(a);
    t.truthy(b);
    t.truthy(c);
    t.truthy(d);
    t.is(a.value, 5);
    t.is(b.value, 10);
    t.is(c, 'C');
    t.is(d.value, 'DD');
});

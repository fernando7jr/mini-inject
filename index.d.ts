export type ClassType = (Function | Object) & { name: string; };
export type ClassConstructor<T> = ClassType & { new(...args: any): T; };
export type Injectable<T> = ClassConstructor<T> | string | Symbol;
export type Dependency = ClassConstructor<any> | string | Symbol | DILiteral<any>;
export type BindingFunc<T> = (di: DI) => T;

/**
 * A resolver object which is mapped to an specific binding
 */
export interface DIResolver<T> {
    /**
     * Get an instance for the previously class binding
     * @returns an instance of T where T is the template param for this method. Vide the method signature
     * @example
     * class A {
     *  bark() {
     *   console.log('Bark!');
     *  }
     * }
     * class B {
     *  constructor (aResovler) {
     *      this.#aResovler = aResovler;
     *  }
     *  
     *  get a() {
     *      return this.#aResolver.get();
     *  }
     * }
     * const di = new DI();
     * di.bind(A, []);
     * di.bind(B, () => new B(di.getResolver(A)));
     * 
     * ...
     * 
     * const b = di.get(B); // B resolves to `null` since there is no binding
     * b.a.bark(); // Bark!
     */
    get(): T;
    /**
     * Get an instance for the previously class binding
     * If the injectable has no binding it will return the value of `fallbackToValue`
     * Please keep in mind that if the binding method throws an exception the error will still happen. 
     * This param only avoid throwing "No binding for injectable" when the unavailable binding is the top one
     * @param fallbackToValue any value which can work as fallback in case the binding does not exists
     * @returns an instance of T or F where T and F are the template params for this method. Vide the method signature
     * @example ```javascript
     * class A {};
     * class B {constructor (a) {this.a = a;}};
     * const di = new DI();
     * 
     * const aResolver = di.getResolver(A);
     * const bResolver = di.getResolver(B);
     * 
     * const a = aResolver.get(null); // A resolves to `null` since there is no binding
     * const a2 = aResolver.get(); // This will throw an error since no fallback was provided 
     * 
     * const b = bResolver.get(null); // B resolves to `null` since there is no binding
     * const b2 = bResolver.get(); // This will throw an error since no fallback was provided 
     * 
     * di.bind(B, []);
     * const b3 = bResolver.get(); // This will throw an error since there is no binding for A which is a dependency of B
     * const b4 = bResolver.get(null); // We still get an error since the fallback only works for the top level which is B in this case
     * ```
     */
    get<F>(fallbackToValue: F): T | F;
}

/**
 * A dependency which is just a plain literal
 * This can be used to assign parameters which are not part or have no binding such as primitives (number, boolean, string) and plain objects
 * Rather than using this class directly, prefer to use the method `literal`
 * @see DI.literal for how to assign literals
 * @example
 * ```javascript
 * class A {
 *  constructor(n: number) {
 *   this.n = n;
 *  }
 * }
 * class B {
 *  constructor(a: A, n: number) {
 *   this.a = a;
 *   this._n = n;
 *  }
 *  
 *  get n() {
 *   return this.a + this._n;
 *  }
 * }
 * 
 * const di = new DI();
 * di.bind(A, [DI.literal(5)]);     // generates (di) => new A(5)
 * di.bind(B, [A, DI.literal(7)]); // generates (di) => new B(7
 * 
 * const [a, b] = di.getAll(A, B);
 * console.log(a.n); // 5
 * console.log(b.n); // 12
 * ```
 */
export class DILiteral<T> {
    private constructor();

    readonly value: T;
}

/**
 * Minimalistic class for dependency injection
 */
export class DI {
    /**
     * Create a `literal` depedency which will be passed directly as parameter instead of resolving it
     * `mini-inject` automatically differentiate `literal` from `injectables` when resolving dependencies
     * @param value any value which does not need a binding and will be used as is instead of resolving an instance from an `injectable` or `key`
     * @returns the `literal` wrapper object
     * @example
     * ```javascript
     * class A {
     *  constructor(n) {
     *   this.n = n;
     *  }
     * }
     * class B {
     *  constructor(a, n) {
     *   this.a = a;
     *   this._n = n;
     *  }
     *  
     *  get n() {
     *   return this.a + this._n;
     *  }
     * }
     * 
     * const di = new DI();
     * di.bind(A, [DI.literal(5)]);     // generates (di) => new A(5)
     * di.bind(B, [A, DI.literal(7)]); // generates (di) => new B(7
     * 
     * const [a, b] = di.getAll(A, B);
     * console.log(a.n); // 5
     * console.log(b.n); // 12
     * ```
     */
    static literal<T>(value: T): DILiteral<T>;
    /**
     * Create a `literal` depedency which will be passed directly as parameter instead of resolving it
     * `mini-inject` automatically differentiate `literal` from `injectables` when resolving dependencies
     * This method is the same as calling `DI.literal` rather than using the instance
     * @param value any value which does not need a binding and will be used as is instead of resolving an instance from an `injectable` or `key`
     * @returns the `literal` wrapper object
     * @example
     * ```javascript
     * class A {
     *  constructor(n) {
     *   this.n = n;
     *  }
     * }
     * class B {
     *  constructor(a, n) {
     *   this.a = a;
     *   this._n = n;
     *  }
     *  
     *  get n() {
     *   return this.a + this._n;
     *  }
     * }
     * 
     * const di = new DI();
     * di.bind(A, [di.literal(5)]);     // generates (di) => new A(5)
     * di.bind(B, [A, di.literal(7)]); // generates (di) => new B(7
     * 
     * const [a, b] = di.getAll(A, B);
     * console.log(a.n); // 5
     * console.log(b.n); // 12
     * ```
     */
    literal<T>(value: T): DILiteral<T>;

    /**
     * Get the binding for the injectable if available otherwise return undefined
     * The binding consists of its parameters and a resolving function for returning the instance 
     * Only known parameters are returned
     * @param injectable an injectable class or a string key-value used for the binding
     * @returns the binding if available otherwise undefined
     */
    getBinding<T>(injectable: Injectable<T>): { isSingleton: boolean; lateResolve: boolean; resolveFunction: () => T; } | undefined;

    /**
     * Get an instance for the previously class binding
     * @param injectable an injectable class or a string key-value used for the binding
     * @returns an instance of T
     * 
     * @example
     * ```javascript
     * class A {
     *   meow() {
     *     console.log('Meow!!');
     *   }
     * }
     * class B {
     *   bark() {
     *     console.log('Bark!!');
     *   }
     * }
     * class C {
     *   constructor(a, b) {
     *     this.a = a;
     *     this.b = b;
     *   }
     * }
     * 
     * const di = new DI();
     * di.bind(A, []);     // generates (di) => new A()
     * di.bind(B, []);     // generates (di) => new B()
     * di.bind(C, [A, B]); // generates (di) => new C(di.get(A), di.get(B))
     * 
     * const a = di.get(A);
     * console.log(a.meow()); // Meow!!
     * 
     * const b = di.get(B);
     * console.log(b.bark()); // Bark!!
     * 
     * const c = di.get(C);
     * console.log(c.a.meow()); // Meow!!
     * console.log(c.b.bark()); // Bark!!
     * ```
     * 
     */
    get<T>(injectable: Injectable<T>): T;
    /**
     * Get an instance for the previously class binding
     * If the injectable has no binding it will return the value of `fallbackToValue`
     * Please keep in mind that if the binding method throws an exception the error will still happen. 
     * This param only avoid throwing "No binding for injectable" when the unavailable binding is the top one
     * @param fallbackToValue any value which can work as fallback in case the binding does not exists
     * @returns an instance of T or F where T and F are the template params for this method. Vide the method signature
     * 
     * @example
     * ```javascript
     * class A {
     *   meow() {
     *     console.log('Meow!!');
     *   }
     * }
     * class B {
     *   bark() {
     *     console.log('Bark!!');
     *   }
     * }
     * class C {
     *   constructor(a, b) {
     *     this.a = a;
     *     this.b = b;
     *   }
     * }
     * class D {}
     * 
     * const di = new DI();
     * di.bind(A, []);     // generates (di) => new A()
     * di.bind(B, []);     // generates (di) => new B()
     * di.bind(C, [A, B]); // generates (di) => new C(di.get(A), di.get(B))
     * 
     * const a = di.get(A);
     * console.log(a.meow()); // Meow!!
     * 
     * const b = di.get(B);
     * console.log(b.bark()); // Bark!!
     * 
     * const c = di.get(C);
     * console.log(c.a.meow()); // Meow!!
     * console.log(c.b.bark()); // Bark!!
     * 
     * const d = di.get(D, null); // D is `null` since there is no binding for D. This does not thrown an error
     * const d2 = di.get(D); // This will thrown an error since there is no fallback for D
     * ```
     * 
     */
    get<T, F>(injectable: Injectable<T>, fallbackToValue: F): T | F;

    /**
     * Get all instances for the previously class bindings
     * @param injectables an array of injectable classes or string key-value used for the binding. See the example
     * @returns an array of instances
     * 
     * @example
     * ```javascript
     * class A {
     *   meow() {
     *     console.log('Meow!!');
     *   }
     * }
     * class B {
     *   bark() {
     *     console.log('Bark!!');
     *   }
     * }
     * class C {
     *   constructor(a, b) {
     *     this.a = a;
     *     this.b = b;
     *   }
     * }
     * 
     * const di = new DI();
     * di.bind(A, []);     // generates (di) => new A()
     * di.bind(B, []);     // generates (di) => new B()
     * di.bind(C, [A, B]); // generates (di) => new C(di.get(A), di.get(B))
     * 
     * const [a, b, c] = di.getAll(A, B, C);
     * console.log(a.meow()); // Meow!!
     * 
     * const b = di.get(B);
     * console.log(b.bark()); // Bark!!
     * console.log(c.a.meow()); // Meow!!
     * console.log(c.b.bark()); // Bark!!
     * ```
     * 
     */
    getAll<T1>(...injectables: [Injectable<T1>]): [T1];
    getAll<T1, T2>(...injectables: [Injectable<T1>, Injectable<T2>]): [T1, T2];
    getAll<T1, T2, T3>(...injectables: [Injectable<T1>, Injectable<T2>, Injectable<T3>]): [T1, T2, T3];
    getAll<T1, T2, T3, T4>(...injectables: [Injectable<T1>, Injectable<T2>, Injectable<T3>, Injectable<T4>]): [T1, T2, T3, T4];
    getAll<T1, T2, T3, T4, T5>(...injectables: [Injectable<T1>, Injectable<T2>, Injectable<T3>, Injectable<T4>, Injectable<T5>]): [T1, T2, T3, T4, T5];
    getAll<T1, T2, T3, T4, T5, T6>(...injectables: [Injectable<T1>, Injectable<T2>, Injectable<T3>, Injectable<T4>, Injectable<T5>, Injectable<T6>]): [T1, T2, T3, T4, T5, T6];
    getAll<T1, T2, T3, T4, T5, T6, T7>(...injectables: [Injectable<T1>, Injectable<T2>, Injectable<T3>, Injectable<T4>, Injectable<T5>, Injectable<T6>, Injectable<T7>]): [T1, T2, T3, T4, T5, T6, T7];
    getAll<T1, T2, T3, T4, T5, T6, T7, T8>(...injectables: [Injectable<T1>, Injectable<T2>, Injectable<T3>, Injectable<T4>, Injectable<T5>, Injectable<T6>, Injectable<T7>, Injectable<T8>]): [T1, T2, T3, T4, T5, T6, T7, T8];
    getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9>(...injectables: [Injectable<T1>, Injectable<T2>, Injectable<T3>, Injectable<T4>, Injectable<T5>, Injectable<T6>, Injectable<T7>, Injectable<T8>, Injectable<T9>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9];
    getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(...injectables: [Injectable<T1>, Injectable<T2>, Injectable<T3>, Injectable<T4>, Injectable<T5>, Injectable<T6>, Injectable<T7>, Injectable<T8>, Injectable<T9>, Injectable<T10>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10];
    getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(...injectables: [Injectable<T1>, Injectable<T2>, Injectable<T3>, Injectable<T4>, Injectable<T5>, Injectable<T6>, Injectable<T7>, Injectable<T8>, Injectable<T9>, Injectable<T10>, Injectable<T11>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11];
    getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12>(...injectables: [Injectable<T1>, Injectable<T2>, Injectable<T3>, Injectable<T4>, Injectable<T5>, Injectable<T6>, Injectable<T7>, Injectable<T8>, Injectable<T9>, Injectable<T10>, Injectable<T11>, Injectable<T12>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12];
    getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13>(...injectables: [Injectable<T1>, Injectable<T2>, Injectable<T3>, Injectable<T4>, Injectable<T5>, Injectable<T6>, Injectable<T7>, Injectable<T8>, Injectable<T9>, Injectable<T10>, Injectable<T11>, Injectable<T12>, Injectable<T13>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13];
    getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14>(...injectables: [Injectable<T1>, Injectable<T2>, Injectable<T3>, Injectable<T4>, Injectable<T5>, Injectable<T6>, Injectable<T7>, Injectable<T8>, Injectable<T9>, Injectable<T10>, Injectable<T11>, Injectable<T12>, Injectable<T13>, Injectable<T14>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14];
    getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15>(...injectables: [Injectable<T1>, Injectable<T2>, Injectable<T3>, Injectable<T4>, Injectable<T5>, Injectable<T6>, Injectable<T7>, Injectable<T8>, Injectable<T9>, Injectable<T10>, Injectable<T11>, Injectable<T12>, Injectable<T13>, Injectable<T14>, Injectable<T15>]): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15];
    getAll(...injectables: Injectable<any>[]): unknown[];

    /**
     * Get an object with a method to get an instance of the class binding
     * @param injectable an injectable class or a string key-value used for the binding
     * @returns an object that resolves to an instance of T
     */
    getResolver<T>(injectable: Injectable<T>): DIResolver<T>;

    /**
     * Bind a class or another constructable object so it can be fetched later
     * The binding method is generated automatically from the injectable and array of dependencies
     * Passing a non constructable class or function along an array of dependencies will throw an error
     * An empty dependencies array will always override the param lateResolve to false
     * 
     * @param injectable an injectable class used for the binding. Must be a constructable class or function
     * @param dependencies array of dependencies to be used when instanciating the injectable. The most be specified at the same order that the constructor parameters
     * @param opts.isSingleton optional param to specify that this injectable is a singleton (only one instance can exist). It is true by default
     * @param opts.lateResolve optional param to specify that this injectable should be resolved later. This means that instanciation will happen later when it is used. This avoids circular dependency problems. It is false by default
     * @returns this
     * 
     * @example
     * ```javascript
     * class A {}
     * class B {}
     * class C {
     *   constructor(a, b) {
     *     this.a = a;
     *     this.b = b;
     *   }
     * }
     * 
     * const di = new DI();
     * di.bind(A, []);     // generates (di) => new A()
     * di.bind(B, []);     // generates (di) => new B()
     * di.bind(C, [A, B]); // generates (di) => new C(di.get(A), di.get(B))
     * ```
     * 
     */
    bind<T>(injectable: ClassConstructor<T>, dependencies: Dependency[], opts?: { isSingleton?: boolean, lateResolve?: boolean; }): this;
    /**
     * Bind a class or another constructable object so it can be fetched later
     * @param injectable an injectable class or a string key-value used for the binding
     * @param func the function called when it should instanciate the object
     * @param opts.isSingleton optional param to specify that this injectable is a singleton (only one instance can exist). It is true by default
     * @param opts.lateResolve optional param to specify that this injectable should be resolved later. This means that instanciation will happen later when it is used. This avoids circular dependency problems. It is false by default
     * @returns this
     * 
     * @example
     * ```javascript
     * class A {}
     * class B {}
     * class C {
     *   constructor(a, b) {
     *     this.a = a;
     *     this.b = b;
     *   }
     * }
     * 
     * const di = new DI();
     * di.bind(A, () => new A());
     * di.bind(B, () => new B());
     * di.bind(C, (di) => new C(di.get(A), di.get(B)));
     * ``` 
     * 
     */
    bind<T>(injectable: Injectable<T>, func: BindingFunc<T>, opts?: { isSingleton?: boolean, lateResolve?: boolean; }): this;
}

export type DIGetter = Pick<DI, 'get' | 'getAll' | 'getResolver'>;

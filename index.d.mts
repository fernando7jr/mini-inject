export type ClassType = (Function | Object) & { name: string; };
export type ClassConstructor<T> = ClassType & { new(...args: any): T; };
export type Injectable<T> = ClassConstructor<T> | string | Symbol;
export type BindingFunc<T> = (di: DI) => T;

/**
 * A resolver object which is mapped to an specific binding
 */
export interface DIResolver<T> {
    /**
     * Get an instance for the previously class binding
     * @returns an instance of T
     */
    get(): T;
}

/**
 * Minimalistic class for dependency injection
 */
export class DI { 
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
     * Get an object with a method to get an instance of the class binding
     * @param injectable an injectable class or a string key-value used for the binding
     * @returns an object that resolves to an instance of T
     */
    getResolver<T>(injectable: Injectable<T>): DIResolver<T>;

    /**
     * Bind a class or another constructable object so it can be fetched later
     * The binding method is generated automatically from the injectable and array of dependencies
     * Passing a non constructable class or function along an array of dependencies will throw an error 
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
    bind<T>(injectable: ClassConstructor<T>, dependencies: Injectable<T>[], opts: {isSingleton?: boolean, lateResolve?: boolean}): this;
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
    bind<T>(injectable: Injectable<T>, func: BindingFunc<T>, opts?: {isSingleton?: boolean, lateResolve?: boolean}): this;
}

export type DIGetter = Pick<DI, 'get' | 'getResolver'>;

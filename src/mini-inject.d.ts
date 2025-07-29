export type ClassType = (Function | Object) & { name: string };
export type ClassConstructor<T> = ClassType & { new (...args: any): T };
export type Injectable<T> = ClassConstructor<T> | string | Symbol;
export type InjectableOrToken<T> = Injectable<T> | Token<T>;
export type Dependency =
  | ClassConstructor<any>
  | string
  | Symbol
  | DILiteral<any>
  | DIFactory<any>;
export type BindingFunc<T> = (di: DI) => T;

/**
 * A Token class for binding injectables
 */
export class Token<T> {
  /**
   * static shortcut for the constructor. The description parameter is automatically calculated if not provided.
   * @param injectable any injectable which this token will always reference
   * @param description an optional string description which is used for generating the symbol
   * @example
   * ````javascript
   * const di = new DI();
   * class A { constructor(value) {this.value = value;} }
   *
   * const tokenA = new Token(A);
   * di.bind(tokenA, [di.literal(5)]);
   * const a = di.get(tokenA);
   *
   * console.log(a.value); // prints "5"
   * ````
   */
  static for<T>(injectable: Injectable<T>): Token<T>;
  /**
   * static shortcut for the constructor. The description parameter is automatically calculated if not provided.
   * @param injectable any injectable which this token will always reference
   * @param description an optional string description which is used for generating the symbol
   * @example
   * ````javascript
   * class A { constructor(value) {this.value = value;} }
   * class B { constructor(value) {this.value = value + 1;} }
   * const tokenA = new Token(A, 'abc');
   * const tokenB = new Token(B, 'abc');
   * // Both tokenA and tokenB resolves to the same binding key
   *
   * const di = new DI();
   * di.bind(tokenA, [di.literal(5)]);
   * console.log(a.value); // prints "5"
   *
   * di.bind(tokenB, [di.literal(5)]); // tokenB override tokenA binding
   * console.log(v.value); // prints "6"
   * ````
   */
  static for<T>(injectable: Injectable<T>, description?: string): Token<T>;

  /**
   * A Token class for binding injectables.
   * Tokens are useful for having more control on how injectables are binded.
   * @param injectable any injectable which this token will always reference
   * @param description an optional string description which is used for generating the symbol
   * @example
   * ````javascript
   * class A { constructor(value) {this.value = value;} }
   * class B { constructor(value) {this.value = value + 1;} }
   * const tokenA = new Token(A, 'abc');
   * const tokenB = new Token(B, 'abc');
   * // Both tokenA and tokenB resolves to the same binding key
   *
   * const di = new DI();
   * di.bind(tokenA, [di.literal(5)]);
   * console.log(a.value); // prints "5"
   *
   * di.bind(tokenB, [di.literal(5)]); // tokenB override tokenA binding
   * console.log(v.value); // prints "6"
   * ````
   */
  constructor(injectable: T, description?: string);

  /**
   * The injectable which the token is refering
   */
  readonly value: T;

  /**
   * Get a symbol representation for the token
   */
  toSymbol(): Symbol;
}

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
export class DILiteral<T> {
  private constructor(value: T);

  readonly value: T;
}

/**
 * A dependency which is retrieved on demand through a factory function.
 * This can be used to assign parameters which are not part or have no binding such as primitives (number, boolean, string), plain objects or anyhting that need an instanciation logic that does not fit a DILiteral.
 * Rather than using this class directly, prefer to use the method `factory`.
 * @see DI.factory for how to assign literals
 * @example
 * ```javascript
 * class A {
 *  constructor(n) {
 *   this.n = `${n} World!`;
 *  }
 * }
 *
 * const fn = () => {
 *  if (process.env.DEV) return 'DEBUG=true; Hello';
 *  else return 'Hello';
 * };
 *
 * const di = new DI();
 * di.bind(A, [DI.factory(fn)]);     // generates (di) => new A('Hello World!') or new A('DEBUG=true; Hello World!') when process.env.DEV is set.
 * // This also works with the instance
 * di.bind(A, [di.factory(fn)]);     // generates (di) => new A('Hello World!') or new A('DEBUG=true; Hello World!') when process.env.DEV is set.
 *
 * const a = di.get(A);
 * console.log(a.n); // Hello World!
 * ```
 */
export class DIFactory<T> {
  private constructor(fn: (di: DIGetter) => T);

  get(di: DIGetter): T;
}

/**
 * Minimalistic class for dependency injection
 */
export class DI {
  /**
   * Minimalistic class for dependency injection
   */
  constructor();

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
   * Create a depedency which is resolved through a `factory` instead of resolving it.
   * `mini-inject` automatically differentiate `factory` from `injectables` when resolving dependencies.
   * @param fn any factory method which accepts the DI instance as the first parameter
   * @returns the `factory` wrapper object
   * @example
   * ```javascript
   * class A {
   *  constructor(n) {
   *   this.n = `${n} World!`;
   *  }
   * }
   *
   * const fn = () => {
   *  if (process.env.DEV) return 'DEBUG=true; Hello';
   *  else return 'Hello';
   * };
   *
   * const di = new DI();
   * di.bind(A, [DI.factory(fn)]);     // generates (di) => new A('Hello World!') or new A('DEBUG=true; Hello World!') when process.env.DEV is set.
   * // This also works with the instance
   * di.bind(A, [di.factory(fn)]);     // generates (di) => new A('Hello World!') or new A('DEBUG=true; Hello World!') when process.env.DEV is set.
   *
   * const a = di.get(A);
   * console.log(a.n); // Hello World!
   * ```
   */
  static factory<T>(fn: (di: DIGetter) => T): DIFactory<T>;

  /**
   * Create a Token instance for binding injectables.
   * Tokens are useful for having more control on how injectables are binded.
   * @param injectable any injectable which this token will always reference
   * @example
   * ````javascript
   * const di = new DI();
   * class A { constructor(value) {this.value = value;} }
   *
   * const tokenA = DI.token(A);
   * di.bind(tokenA, [DI.literal(5)]);
   * const a = di.get(tokenA);
   *
   * console.log(a.value); // prints "5"
   * ````
   */
  static token<T>(injectable: Injectable<T>): Token<T>;
  /**
   * Create a Token instance for binding injectables.
   * Tokens are useful for having more control on how injectables are binded.
   * @param injectable any injectable which this token will always reference
   * @param description an optional string description which is used for generating the symbol
   * @example
   * ````javascript
   * class A { constructor(value) {this.value = value;} }
   * class B { constructor(value) {this.value = value + 1;} }
   * const tokenA = new Token(A, 'abc');
   * const tokenB = new Token(B, 'abc');
   * // Both tokenA and tokenB resolves to the same binding key
   *
   * const di = new DI();
   * di.bind(tokenA, [di.literal(5)]);
   * console.log(a.value); // prints "5"
   *
   * di.bind(tokenB, [di.literal(5)]); // tokenB override tokenA binding
   * console.log(v.value); // prints "6"
   * ````
   */
  static token<T>(injectable: Injectable<T>, description?: string): Token<T>;

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
   * Create a depedency which is resolved through a `factory` instead of resolving it.
   * `mini-inject` automatically differentiate `factory` from `injectables` when resolving dependencies.
   * @param fn any factory method which accepts the DI instance as the first parameter
   * @returns the `factory` wrapper object
   * @example
   * ```javascript
   * class A {
   *  constructor(n) {
   *   this.n = `${n} World!`;
   *  }
   * }
   *
   * const fn = () => {
   *  if (process.env.DEV) return 'DEBUG=true; Hello';
   *  else return 'Hello';
   * };
   *
   * const di = new DI();
   * di.bind(A, [DI.factory(fn)]);     // generates (di) => new A('Hello World!') or new A('DEBUG=true; Hello World!') when process.env.DEV is set.
   * // This also works with the instance
   * di.bind(A, [di.factory(fn)]);     // generates (di) => new A('Hello World!') or new A('DEBUG=true; Hello World!') when process.env.DEV is set.
   *
   * const a = di.get(A);
   * console.log(a.n); // Hello World!
   * ```
   */
  factory<T>(fn: (di: DIGetter) => T): DIFactory<T>;

  /**
   * Create a Token instance for binding injectables.
   * Tokens are useful for having more control on how injectables are binded.
   * @param injectable any injectable which this token will always reference
   * @example
   * ````javascript
   * const di = new DI();
   * class A { constructor(value) {this.value = value;} }
   *
   * const tokenA = di.token(A);
   * di.bind(tokenA, [di.literal(5)]);
   * const a = di.get(tokenA);
   *
   * console.log(a.value); // prints "5"
   * ````
   */
  token<T>(injectable: Injectable<T>): Token<T>;
  /**
   * Create a Token instance for binding injectables.
   * Tokens are useful for having more control on how injectables are binded.
   * @param injectable any injectable which this token will always reference
   * @param description an optional string description which is used for generating the symbol
   * @example
   * ````javascript
   * class A { constructor(value) {this.value = value;} }
   * class B { constructor(value) {this.value = value + 1;} }
   * const tokenA = new Token(A, 'abc');
   * const tokenB = new Token(B, 'abc');
   * // Both tokenA and tokenB resolves to the same binding key
   *
   * const di = new DI();
   * di.bind(tokenA, [di.literal(5)]);
   * console.log(a.value); // prints "5"
   *
   * di.bind(tokenB, [di.literal(5)]); // tokenB override tokenA binding
   * console.log(v.value); // prints "6"
   * ````
   */
  token<T>(injectable: Injectable<T>, description?: string): Token<T>;

  /**
   * Get the binding for the injectable if available otherwise return undefined
   * The binding consists of its parameters and a resolving function for returning the instance
   * Only known parameters are returned
   * @param injectable an injectable class or a string key-value used for the binding
   * @returns the binding if available otherwise undefined
   */
  getBinding<T>(
    injectable: InjectableOrToken<T>
  ):
    | { isSingleton: boolean; lateResolve: boolean; resolveFunction: () => T }
    | undefined;

  /**
   * Check if the module has a binding for an injectable
   * @param injectable an injectable class or a string key-value used for the binding
   * @returns true if the binding exists otherwise false
   */
  has<T>(injectable: InjectableOrToken<T>): boolean;

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
  get<T>(injectable: InjectableOrToken<T>): T;
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
  get<T, F>(injectable: InjectableOrToken<T>, fallbackToValue: F): T | F;

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
  getAll<T1>(...injectables: [InjectableOrToken<T1>]): [T1];
  getAll<T1, T2>(
    ...injectables: [InjectableOrToken<T1>, InjectableOrToken<T2>]
  ): [T1, T2];
  getAll<T1, T2, T3>(
    ...injectables: [
      InjectableOrToken<T1>,
      InjectableOrToken<T2>,
      InjectableOrToken<T3>
    ]
  ): [T1, T2, T3];
  getAll<T1, T2, T3, T4>(
    ...injectables: [
      InjectableOrToken<T1>,
      InjectableOrToken<T2>,
      InjectableOrToken<T3>,
      InjectableOrToken<T4>
    ]
  ): [T1, T2, T3, T4];
  getAll<T1, T2, T3, T4, T5>(
    ...injectables: [
      InjectableOrToken<T1>,
      InjectableOrToken<T2>,
      InjectableOrToken<T3>,
      InjectableOrToken<T4>,
      InjectableOrToken<T5>
    ]
  ): [T1, T2, T3, T4, T5];
  getAll<T1, T2, T3, T4, T5, T6>(
    ...injectables: [
      InjectableOrToken<T1>,
      InjectableOrToken<T2>,
      InjectableOrToken<T3>,
      InjectableOrToken<T4>,
      InjectableOrToken<T5>,
      InjectableOrToken<T6>
    ]
  ): [T1, T2, T3, T4, T5, T6];
  getAll<T1, T2, T3, T4, T5, T6, T7>(
    ...injectables: [
      InjectableOrToken<T1>,
      InjectableOrToken<T2>,
      InjectableOrToken<T3>,
      InjectableOrToken<T4>,
      InjectableOrToken<T5>,
      InjectableOrToken<T6>,
      InjectableOrToken<T7>
    ]
  ): [T1, T2, T3, T4, T5, T6, T7];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8>(
    ...injectables: [
      InjectableOrToken<T1>,
      InjectableOrToken<T2>,
      InjectableOrToken<T3>,
      InjectableOrToken<T4>,
      InjectableOrToken<T5>,
      InjectableOrToken<T6>,
      InjectableOrToken<T7>,
      InjectableOrToken<T8>
    ]
  ): [T1, T2, T3, T4, T5, T6, T7, T8];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9>(
    ...injectables: [
      InjectableOrToken<T1>,
      InjectableOrToken<T2>,
      InjectableOrToken<T3>,
      InjectableOrToken<T4>,
      InjectableOrToken<T5>,
      InjectableOrToken<T6>,
      InjectableOrToken<T7>,
      InjectableOrToken<T8>,
      InjectableOrToken<T9>
    ]
  ): [T1, T2, T3, T4, T5, T6, T7, T8, T9];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
    ...injectables: [
      InjectableOrToken<T1>,
      InjectableOrToken<T2>,
      InjectableOrToken<T3>,
      InjectableOrToken<T4>,
      InjectableOrToken<T5>,
      InjectableOrToken<T6>,
      InjectableOrToken<T7>,
      InjectableOrToken<T8>,
      InjectableOrToken<T9>,
      InjectableOrToken<T10>
    ]
  ): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(
    ...injectables: [
      InjectableOrToken<T1>,
      InjectableOrToken<T2>,
      InjectableOrToken<T3>,
      InjectableOrToken<T4>,
      InjectableOrToken<T5>,
      InjectableOrToken<T6>,
      InjectableOrToken<T7>,
      InjectableOrToken<T8>,
      InjectableOrToken<T9>,
      InjectableOrToken<T10>,
      InjectableOrToken<T11>
    ]
  ): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12>(
    ...injectables: [
      InjectableOrToken<T1>,
      InjectableOrToken<T2>,
      InjectableOrToken<T3>,
      InjectableOrToken<T4>,
      InjectableOrToken<T5>,
      InjectableOrToken<T6>,
      InjectableOrToken<T7>,
      InjectableOrToken<T8>,
      InjectableOrToken<T9>,
      InjectableOrToken<T10>,
      InjectableOrToken<T11>,
      InjectableOrToken<T12>
    ]
  ): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13>(
    ...injectables: [
      InjectableOrToken<T1>,
      InjectableOrToken<T2>,
      InjectableOrToken<T3>,
      InjectableOrToken<T4>,
      InjectableOrToken<T5>,
      InjectableOrToken<T6>,
      InjectableOrToken<T7>,
      InjectableOrToken<T8>,
      InjectableOrToken<T9>,
      InjectableOrToken<T10>,
      InjectableOrToken<T11>,
      InjectableOrToken<T12>,
      InjectableOrToken<T13>
    ]
  ): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14>(
    ...injectables: [
      InjectableOrToken<T1>,
      InjectableOrToken<T2>,
      InjectableOrToken<T3>,
      InjectableOrToken<T4>,
      InjectableOrToken<T5>,
      InjectableOrToken<T6>,
      InjectableOrToken<T7>,
      InjectableOrToken<T8>,
      InjectableOrToken<T9>,
      InjectableOrToken<T10>,
      InjectableOrToken<T11>,
      InjectableOrToken<T12>,
      InjectableOrToken<T13>,
      InjectableOrToken<T14>
    ]
  ): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15>(
    ...injectables: [
      InjectableOrToken<T1>,
      InjectableOrToken<T2>,
      InjectableOrToken<T3>,
      InjectableOrToken<T4>,
      InjectableOrToken<T5>,
      InjectableOrToken<T6>,
      InjectableOrToken<T7>,
      InjectableOrToken<T8>,
      InjectableOrToken<T9>,
      InjectableOrToken<T10>,
      InjectableOrToken<T11>,
      InjectableOrToken<T12>,
      InjectableOrToken<T13>,
      InjectableOrToken<T14>,
      InjectableOrToken<T15>
    ]
  ): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15];
  getAll(...injectables: InjectableOrToken<any>[]): unknown[];

  /**
   * Get an object with a method to get an instance of the class binding
   * @param injectable an injectable class or a string key-value used for the binding
   * @returns an object that resolves to an instance of T
   */
  getResolver<T>(injectable: InjectableOrToken<T>): DIResolver<T>;

  /**
   * Bind a class or another constructable object so it can be fetched later
   * The binding method is generated automatically from the injectable and array of dependencies
   * Passing a non constructable class or function along an array of dependencies will throw an error. Tokens are acceptable though
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
  bind<T>(
    injectable: ClassConstructor<T> | Token<T>,
    dependencies: Dependency[],
    opts?: { isSingleton?: boolean; lateResolve?: boolean }
  ): this;
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
  bind<T>(
    injectable: InjectableOrToken<T>,
    func: BindingFunc<T>,
    opts?: { isSingleton?: boolean; lateResolve?: boolean }
  ): this;
  /**
   * Bind a class or another constructable object so it can be fetched later
   * The binding method is generated automatically from the injectable and array of dependencies
   * Passing a non constructable class or function along an array of dependencies will throw an error. Tokens are acceptable though
   *
   * @param injectable an injectable class used for the binding. Must be a constructable class or function
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
   * di.bind(A);     // generates (di) => new A()
   * di.bind(B);     // generates (di) => new B()
   * di.bind(C, [A, B]); // generates (di) => new C(di.get(A), di.get(B))
   * ```
   *
   */
  bind<T>(injectable: ClassConstructor<T> | Token<T>): this;

  /**
   * Add a sub-module to this. When resolving dependencies it will also search in the sub-modules.
   * Any `DI` instance can have as many sub-modules as necessary. However beware that each module can only access it own dependencies and its sub-modules.
   * A sub-module does not has access to its parent dependencies. During dependency resolution, each module always use its own bindings before trying the subModules.
   * If more than one sub-module has the same binding then the first sub-module attached will be used.
   * @param di a `DI` instance to be a sub-module
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
   * di.bind(A, []);
   * di.bind(B, []);
   * di.bind(C, [A, B]);
   *
   * class SubA {}
   * class SubB {}
   * const subModule = new DI();
   * subModule.bind(SubA, []);
   * subModule.bind(SubB, []);
   * di.subModule(subModule);
   *
   * // This works fine, getting from di is the same as subModule directly
   * const subA = di.get(SubA, undefined);
   * console.log(subA instanceof SubA); // true
   * const subB = di.get(SubB, undefined);
   * console.log(subB instanceof SubB); // true
   *
   * // This will fail since subModule does not has access to he parent module
   * const a = subModule.get(A, undefined);
   * console.log(a instanceof SubA, a); // false undefined
   * const b = subModule.get(B, undefined);
   * console.log(b instanceof B, b); // false undefined
   * ```
   */
  subModule(di: DIGetter): this;
  /**
   * Add a sub-module to this. When resolving dependencies it will also search in the sub-modules.
   * Any `DI` instance can have as many sub-modules as necessary. However beware that each module can only access it own dependencies and its sub-modules.
   * A sub-module does not has access to its parent dependencies. During dependency resolution, each module always use its own bindings before trying the subModules.
   * If more than one sub-module has the same binding then the first sub-module attached will be used.
   * @param modules a spread array of `DI` instances to become sub-modules of this
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
   * di.bind(A, []);
   * di.bind(B, []);
   * di.bind(C, [A, B]);
   *
   * class SubA {}
   * class SubB {}
   * const subModule = new DI();
   * subModule.bind(SubA, []);
   * subModule.bind(SubB, []);
   * di.subModule(subModule);
   *
   * // This works fine, getting from di is the same as subModule directly
   * const subA = di.get(SubA, undefined);
   * console.log(subA instanceof SubA); // true
   * const subB = di.get(SubB, undefined);
   * console.log(subB instanceof SubB); // true
   *
   * // This will fail since subModule does not has access to he parent module
   * const a = subModule.get(A, undefined);
   * console.log(a instanceof SubA, a); // false undefined
   * const b = subModule.get(B, undefined);
   * console.log(b instanceof B, b); // false undefined
   * ```
   */
  subModule(...modules: DIGetter[]): this;

  /**
   * Clears all containers, bindings, and sub-modules from this DI instance.
   * This method also recursively clears all sub-modules.
   * After calling clear(), the DI instance will be in a clean state as if it was just created.
   * @returns void
   * @example
   * ```javascript
   * const di = new DI();
   * di.bind('service', () => ({ value: 'test' }));
   *
   * const subModule = new DI();
   * subModule.bind('subService', () => ({ value: 'sub' }));
   * di.subModule(subModule);
   *
   * console.log(di.has('service')); // true
   * console.log(di.has('subService')); // true
   *
   * di.clear();
   *
   * console.log(di.has('service')); // false
   * console.log(di.has('subService')); // false
   * console.log(subModule.has('subService')); // false (sub-modules are also cleared)
   * ```
   */
  clear(): void;
}

export type DIGetter = Pick<
  DI,
  "get" | "getAll" | "getResolver" | "getBinding" | "has"
>;

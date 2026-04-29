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

// ─── Dependency graph ────────────────────────────────────────────────────────

/** A single dependency descriptor inside a graph node's `deps` array. */
export type DepDescriptor =
  | { type: "injectable"; key: string }
  | { type: "literal"; value: unknown }
  | { type: "factory"; name: string | null };

/**
 * A node in the dependency graph — one per binding registered in the DI module.
 * Nodes whose binding was declared with a custom factory function have `deps: null`
 * because the dependencies cannot be statically determined.
 */
export interface GraphNode {
  /** Human-readable display key (class name, string key, or `Token<description>`). */
  key: string;
  isSingleton: boolean;
  lateResolve: boolean;
  /** `true` when the binding originates from an attached sub-module. */
  isSubModule: boolean;
  /**
   * Dependency descriptors for each position in the binding's dependency list.
   * `null` means the binding was declared with a custom factory function and the
   * dependencies cannot be statically determined.
   */
  deps: DepDescriptor[] | null;
}

/** A directed edge between two injectable nodes in the dependency graph. */
export interface GraphEdge {
  from: string;
  to: string;
  /** `true` when this edge is part of at least one circular-dependency cycle. */
  isCircular: boolean;
}

/** Full dependency graph returned by `DI.getDependencyGraph()`. */
export interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
  /**
   * Each cycle is an array of display keys where the first key is repeated at
   * the end to make the loop explicit, e.g. `["A", "B", "A"]`.
   */
  cycles: string[][];
}

/** Options for `formatDependencyGraph`. */
export interface FormatGraphOptions {
  /**
   * When `true` (default), a title line and a cycles summary section are
   * included in the output. Pass `false` to get rows only.
   */
  header?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Describes which dependency shapes are acceptable for a single constructor parameter of type `T`.
 *
 * - `ClassConstructor<T>` — inject a class whose instance type is `T` (only valid when `T extends object`)
 * - `Token<T>` — a typed Token wrapping a binding of type `T`
 * - `DILiteral<T>` — a literal value of type `T` (use `di.literal(value)` or `DI.literal(value)`)
 * - `DIFactory<T>` — a factory function returning `T` (use `di.factory(fn)` or `DI.factory(fn)`)
 * - `string` / `Symbol` — named binding escape hatches; type-unsafe per position but always accepted
 */
export type DependencyFor<T> =
  | (T extends object ? ClassConstructor<T> : never)
  | Token<T>
  | DILiteral<T>
  | DIFactory<T>
  | string
  | Symbol;

/**
 * Maps a constructor-parameter tuple to a same-length dependency tuple where each slot only
 * accepts a dependency that is compatible with the corresponding parameter type.
 *
 * Both array-length mismatches and per-position type mismatches become TypeScript compile errors
 * when this type is used in a `bind` overload.
 *
 * @example
 * ```typescript
 * class C { constructor(a: A, n: number) {} }
 *
 * // DependenciesFor<[A, number]> resolves to:
 * // [DependencyFor<A>, DependencyFor<number>]
 * // i.e. [ClassConstructor<A> | Token<A> | DILiteral<A> | DIFactory<A> | string | Symbol,
 * //        Token<number> | DILiteral<number> | DIFactory<number> | string | Symbol]
 * ```
 */
export type DependenciesFor<Params extends readonly unknown[]> = {
  [K in keyof Params]: DependencyFor<Params[K]>;
};

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

  /** The name of the wrapped factory function, or `null` if it is anonymous. */
  readonly name: string | null;

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
   * Globally enable or disable automatic circular-dependency resolution for **all** `DI` instances.
   *
   * When `true`, every `DI` instance will detect dependency cycles at resolution time and
   * transparently create a lazy `Proxy` only for the binding that is caught in the cycle —
   * no `lateResolve` flag is needed on any binding. The `lateResolve` option is silently
   * ignored while this global flag is active.
   *
   * The global flag takes **precedence** over the instance-level
   * `autoResolveCircularDependencies()` method: if the global flag is `true`, every instance
   * behaves as if its own flag is also `true`, regardless of the instance-level setting.
   *
   * When both flags are `false` (the default), and a circular dependency is detected,
   * `get()` throws a descriptive error listing the full dependency chain and instructions
   * on how to resolve it.
   *
   * @param enabled pass `true` to activate global auto-resolution, `false` to deactivate
   * @example
   * ```javascript
   * class A { constructor(b) { this.b = b; } }
   * class B { constructor(a) { this.a = a; } }
   *
   * DI.autoResolveCircularDependencies(true);
   *
   * const di = new DI();
   * di.bind(A, () => new A(di.get(B)));
   * di.bind(B, () => new B(di.get(A)));
   *
   * const a = di.get(A); // resolves without lateResolve
   * console.log(a.b instanceof B); // true
   *
   * DI.autoResolveCircularDependencies(false); // restore default
   * ```
   */
  static autoResolveCircularDependencies(enabled: boolean): void;

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
   * Enable or disable automatic circular-dependency resolution for **this** `DI` instance.
   *
   * When `true`, this instance will detect dependency cycles at resolution time and
   * transparently create a lazy `Proxy` only for the binding caught in the cycle —
   * no `lateResolve` flag is needed. The `lateResolve` option is silently ignored while
   * this flag (or the global one) is active.
   *
   * **Priority order:**
   * 1. `DI.autoResolveCircularDependencies(true)` — global flag; overrides every instance.
   * 2. `instance.autoResolveCircularDependencies(true)` — applies to this instance only.
   * 3. `lateResolve: true` on a binding — manual opt-in for specific bindings.
   * 4. Default — circular dependencies throw a descriptive error listing the full chain.
   *
   * Returns `this` to allow chaining.
   *
   * @param enabled pass `true` to activate auto-resolution on this instance, `false` to deactivate
   * @returns this
   * @example
   * ```javascript
   * class A { constructor(b) { this.b = b; } }
   * class B { constructor(a) { this.a = a; } }
   *
   * const di = new DI();
   * di.autoResolveCircularDependencies(true);
   * di.bind(A, () => new A(di.get(B)));
   * di.bind(B, () => new B(di.get(A)));
   *
   * const a = di.get(A); // resolves without lateResolve
   * console.log(a.b instanceof B); // true
   *
   * // Another instance is unaffected
   * const di2 = new DI(); // auto mode is off here
   * ```
   */
  autoResolveCircularDependencies(enabled: boolean): this;

  /**
   * Build a dependency graph for this DI module (and any attached sub-modules).
   *
   * Bindings declared with an array of dependencies are fully described.
   * Bindings declared with a custom factory function have `deps: null` because
   * the dependencies cannot be statically determined at analysis time.
   *
   * The graph can be serialised directly with `JSON.stringify` for JSON output.
   */
  getDependencyGraph(): DependencyGraph;

  /**
   * Build a dependency graph for the given DI module.
   * Convenience static wrapper around the instance method.
   * @param di The DI instance to analyse.
   */
  static getDependencyGraph(di: DI): DependencyGraph;

  /**
   * Render the dependency graph of this module as a human-readable text report.
   * @param opts Optional formatting options (e.g. `{ header: false }`).
   */
  formatDependencyGraph(opts?: FormatGraphOptions): string;

  /**
   * Render a pre-computed `DependencyGraph` as a human-readable text report.
   * Useful when you have already obtained the graph object and want to format it
   * separately — for example after enriching or filtering it.
   * @param graph A graph previously returned by `getDependencyGraph`.
   * @param opts Optional formatting options.
   */
  static formatDependencyGraph(
    graph: DependencyGraph,
    opts?: FormatGraphOptions,
  ): string;

  /**
   * Get the binding for the injectable if available otherwise return undefined
   * The binding consists of its parameters and a resolving function for returning the instance
   * Only known parameters are returned
   * @param injectable an injectable class or a string key-value used for the binding
   * @returns the binding if available otherwise undefined
   */
  getBinding<T>(
    injectable: InjectableOrToken<T>,
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
   * Get an instance for the previously class binding.
   *
   * **Circular dependency handling** — three strategies are available, applied in priority order:
   * 1. **Auto mode** (`DI.autoResolveCircularDependencies(true)` or `instance.autoResolveCircularDependencies(true)`)
   *    — cycles are detected at runtime; only the binding caught in the cycle receives a lazy `Proxy`.
   *    No `lateResolve` flag needed on any binding.
   * 2. **Manual `lateResolve`** — mark one binding with `{ lateResolve: true }` to break the cycle with a `Proxy`
   *    (ignored when auto mode is active).
   * 3. **Neither** — if a cycle is encountered, `get()` throws immediately with a descriptive error that lists the
   *    full dependency chain (e.g. `"Circular dependency detected: A → B → A"`) and instructions on how to fix it.
   *
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
  getAll<T1>(injectable1: InjectableOrToken<T1>): [T1];
  getAll<T1, T2>(
    injectable1: InjectableOrToken<T1>,
    injectable2: InjectableOrToken<T2>,
  ): [T1, T2];
  getAll<T1, T2, T3>(
    injectable1: InjectableOrToken<T1>,
    injectable2: InjectableOrToken<T2>,
    injectable3: InjectableOrToken<T3>,
  ): [T1, T2, T3];
  getAll<T1, T2, T3, T4>(
    injectable1: InjectableOrToken<T1>,
    injectable2: InjectableOrToken<T2>,
    injectable3: InjectableOrToken<T3>,
    injectable4: InjectableOrToken<T4>,
  ): [T1, T2, T3, T4];
  getAll<T1, T2, T3, T4, T5>(
    injectable1: InjectableOrToken<T1>,
    injectable2: InjectableOrToken<T2>,
    injectable3: InjectableOrToken<T3>,
    injectable4: InjectableOrToken<T4>,
    injectable5: InjectableOrToken<T5>,
  ): [T1, T2, T3, T4, T5];
  getAll<T1, T2, T3, T4, T5, T6>(
    injectable1: InjectableOrToken<T1>,
    injectable2: InjectableOrToken<T2>,
    injectable3: InjectableOrToken<T3>,
    injectable4: InjectableOrToken<T4>,
    injectable5: InjectableOrToken<T5>,
    injectable6: InjectableOrToken<T6>,
  ): [T1, T2, T3, T4, T5, T6];
  getAll<T1, T2, T3, T4, T5, T6, T7>(
    injectable1: InjectableOrToken<T1>,
    injectable2: InjectableOrToken<T2>,
    injectable3: InjectableOrToken<T3>,
    injectable4: InjectableOrToken<T4>,
    injectable5: InjectableOrToken<T5>,
    injectable6: InjectableOrToken<T6>,
    injectable7: InjectableOrToken<T7>,
  ): [T1, T2, T3, T4, T5, T6, T7];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8>(
    injectable1: InjectableOrToken<T1>,
    injectable2: InjectableOrToken<T2>,
    injectable3: InjectableOrToken<T3>,
    injectable4: InjectableOrToken<T4>,
    injectable5: InjectableOrToken<T5>,
    injectable6: InjectableOrToken<T6>,
    injectable7: InjectableOrToken<T7>,
    injectable8: InjectableOrToken<T8>,
  ): [T1, T2, T3, T4, T5, T6, T7, T8];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9>(
    injectable1: InjectableOrToken<T1>,
    injectable2: InjectableOrToken<T2>,
    injectable3: InjectableOrToken<T3>,
    injectable4: InjectableOrToken<T4>,
    injectable5: InjectableOrToken<T5>,
    injectable6: InjectableOrToken<T6>,
    injectable7: InjectableOrToken<T7>,
    injectable8: InjectableOrToken<T8>,
    injectable9: InjectableOrToken<T9>,
  ): [T1, T2, T3, T4, T5, T6, T7, T8, T9];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10>(
    injectable1: InjectableOrToken<T1>,
    injectable2: InjectableOrToken<T2>,
    injectable3: InjectableOrToken<T3>,
    injectable4: InjectableOrToken<T4>,
    injectable5: InjectableOrToken<T5>,
    injectable6: InjectableOrToken<T6>,
    injectable7: InjectableOrToken<T7>,
    injectable8: InjectableOrToken<T8>,
    injectable9: InjectableOrToken<T9>,
    injectable10: InjectableOrToken<T10>,
  ): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11>(
    injectable1: InjectableOrToken<T1>,
    injectable2: InjectableOrToken<T2>,
    injectable3: InjectableOrToken<T3>,
    injectable4: InjectableOrToken<T4>,
    injectable5: InjectableOrToken<T5>,
    injectable6: InjectableOrToken<T6>,
    injectable7: InjectableOrToken<T7>,
    injectable8: InjectableOrToken<T8>,
    injectable9: InjectableOrToken<T9>,
    injectable10: InjectableOrToken<T10>,
    injectable11: InjectableOrToken<T11>,
  ): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12>(
    injectable1: InjectableOrToken<T1>,
    injectable2: InjectableOrToken<T2>,
    injectable3: InjectableOrToken<T3>,
    injectable4: InjectableOrToken<T4>,
    injectable5: InjectableOrToken<T5>,
    injectable6: InjectableOrToken<T6>,
    injectable7: InjectableOrToken<T7>,
    injectable8: InjectableOrToken<T8>,
    injectable9: InjectableOrToken<T9>,
    injectable10: InjectableOrToken<T10>,
    injectable11: InjectableOrToken<T11>,
    injectable12: InjectableOrToken<T12>,
  ): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13>(
    injectable1: InjectableOrToken<T1>,
    injectable2: InjectableOrToken<T2>,
    injectable3: InjectableOrToken<T3>,
    injectable4: InjectableOrToken<T4>,
    injectable5: InjectableOrToken<T5>,
    injectable6: InjectableOrToken<T6>,
    injectable7: InjectableOrToken<T7>,
    injectable8: InjectableOrToken<T8>,
    injectable9: InjectableOrToken<T9>,
    injectable10: InjectableOrToken<T10>,
    injectable11: InjectableOrToken<T11>,
    injectable12: InjectableOrToken<T12>,
    injectable13: InjectableOrToken<T13>,
  ): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14>(
    injectable1: InjectableOrToken<T1>,
    injectable2: InjectableOrToken<T2>,
    injectable3: InjectableOrToken<T3>,
    injectable4: InjectableOrToken<T4>,
    injectable5: InjectableOrToken<T5>,
    injectable6: InjectableOrToken<T6>,
    injectable7: InjectableOrToken<T7>,
    injectable8: InjectableOrToken<T8>,
    injectable9: InjectableOrToken<T9>,
    injectable10: InjectableOrToken<T10>,
    injectable11: InjectableOrToken<T11>,
    injectable12: InjectableOrToken<T12>,
    injectable13: InjectableOrToken<T13>,
    injectable14: InjectableOrToken<T14>,
  ): [T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14];
  getAll<T1, T2, T3, T4, T5, T6, T7, T8, T9, T10, T11, T12, T13, T14, T15>(
    injectable1: InjectableOrToken<T1>,
    injectable2: InjectableOrToken<T2>,
    injectable3: InjectableOrToken<T3>,
    injectable4: InjectableOrToken<T4>,
    injectable5: InjectableOrToken<T5>,
    injectable6: InjectableOrToken<T6>,
    injectable7: InjectableOrToken<T7>,
    injectable8: InjectableOrToken<T8>,
    injectable9: InjectableOrToken<T9>,
    injectable10: InjectableOrToken<T10>,
    injectable11: InjectableOrToken<T11>,
    injectable12: InjectableOrToken<T12>,
    injectable13: InjectableOrToken<T13>,
    injectable14: InjectableOrToken<T14>,
    injectable15: InjectableOrToken<T15>,
    ...injectables: InjectableOrToken<any>[]
  ): [
    T1,
    T2,
    T3,
    T4,
    T5,
    T6,
    T7,
    T8,
    T9,
    T10,
    T11,
    T12,
    T13,
    T14,
    T15,
    ...unknown[],
  ];

  /**
   * Get an object with a method to get an instance of the class binding
   * @param injectable an injectable class or a string key-value used for the binding
   * @returns an object that resolves to an instance of T
   */
  getResolver<T>(injectable: InjectableOrToken<T>): DIResolver<T>;

  /**
   * Bind a class or another constructable object so it can be fetched later.
   * The binding method is generated automatically from the injectable and array of dependencies.
   *
   * **Typed overload** — when `injectable` is a concrete class (not a Token or string key), TypeScript
   * infers the constructor-parameter types and validates each slot in `dependencies` against the
   * corresponding parameter type via `DependenciesFor`. Both the array length and the per-position
   * types are checked at compile time.
   *
   * Each dependency slot accepts:
   * - The class itself (for object-type params)
   * - A `Token<T>` wrapping the expected type
   * - `DI.literal(value)` / `di.literal(value)` — a `DILiteral<T>` with matching value type
   * - `DI.factory(fn)` / `di.factory(fn)` — a `DIFactory<T>` returning the expected type
   * - A `string` or `Symbol` named binding (escape hatch — accepted in every slot but type-unsafe)
   *
   * @param injectable a constructable class whose constructor parameter types drive the dependency check
   * @param dependencies a tuple of dependencies, one per constructor parameter, in the same order
   * @param opts.isSingleton optional; `true` by default
   * @param opts.lateResolve optional; defers instantiation until first property access (Proxy). Ignored in auto mode.
   * @returns this
   *
   * @example
   * ```typescript
   * class A { constructor(public n: number) {} }
   * class B { constructor(public a: A, public label: string) {} }
   *
   * const di = new DI();
   * di.bind(A, [di.literal(5)]);          // ✓  DILiteral<number> matches `number`
   * di.bind(B, [A, di.literal('hello')]); // ✓  ClassConstructor<A> + DILiteral<string>
   * di.bind(B, [di.literal(5), A]);       // ✗  compile error — wrong types in wrong slots
   * di.bind(B, [A]);                      // ✗  compile error — too few dependencies
   * ```
   */
  bind<T extends object, Args extends readonly unknown[]>(
    injectable: (new (...args: [...Args]) => T) | Token<T>,
    dependencies: DependenciesFor<Args>,
    opts?: { isSingleton?: boolean; lateResolve?: boolean; eager?: boolean },
  ): this;
  /**
   * Bind a class or another constructable object so it can be fetched later
   * The binding method is generated automatically from the injectable and array of dependencies
   * Passing a non constructable class or function along an array of dependencies will throw an error. Tokens are acceptable though
   *
   * @param injectable an injectable class used for the binding. Must be a constructable class or function
   * @param dependencies array of dependencies to be used when instanciating the injectable. The most be specified at the same order that the constructor parameters
   * @param opts.isSingleton optional param to specify that this injectable is a singleton (only one instance can exist). It is true by default
   * @param opts.lateResolve optional param to defer instantiation of this injectable until the first time a property is accessed on it.
   * When `true`, a transparent `Proxy` is stored in the container immediately and the real instance is created on first access.
   * This is the manual opt-in for breaking circular dependencies. It is `false` by default.
   * **Note:** this flag is silently ignored when `autoResolveCircularDependencies` is enabled (globally or on this instance) —
   * in that mode cycles are detected automatically and only the binding actually caught in the cycle receives a Proxy.
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
    opts?: { isSingleton?: boolean; lateResolve?: boolean; eager?: boolean },
  ): this;
  /**
   * Bind a class or another constructable object so it can be fetched later
   * @param injectable an injectable class or a string key-value used for the binding
   * @param func the function called when it should instanciate the object
   * @param opts.isSingleton optional param to specify that this injectable is a singleton (only one instance can exist). It is true by default
   * @param opts.lateResolve optional param to defer instantiation of this injectable until the first time a property is accessed on it.
   * When `true`, a transparent `Proxy` is stored in the container immediately and the real instance is created on first access.
   * This is the manual opt-in for breaking circular dependencies. It is `false` by default.
   * **Note:** this flag is silently ignored when `autoResolveCircularDependencies` is enabled (globally or on this instance) —
   * in that mode cycles are detected automatically and only the binding actually caught in the cycle receives a Proxy.
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
    opts?: { isSingleton?: boolean; lateResolve?: boolean; eager?: boolean },
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
   * Remove the binding (and its cached singleton instance, if any) for a single injectable.
   * If the cached instance exposes a `dispose()` method, it is called before the instance
   * is removed from the container — giving it a chance to release resources (timers, connections, etc.).
   * Errors thrown by `dispose()` are silently ignored.
   *
   * Has no effect when the injectable has no binding.
   *
   * @param injectable an injectable class, string key, Symbol, or Token
   * @returns this
   * @example
   * ```javascript
   * class DbConnection {
   *   constructor() { this.open = true; }
   *   dispose() { this.open = false; }
   * }
   *
   * const di = new DI();
   * di.bind(DbConnection, []);
   *
   * const conn = di.get(DbConnection);
   * console.log(conn.open); // true
   *
   * di.unbind(DbConnection);
   * console.log(conn.open);          // false  — dispose() was called
   * console.log(di.has(DbConnection)); // false  — binding removed
   * ```
   */
  unbind<T>(injectable: InjectableOrToken<T>): this;

  /**
   * Create a fork (child scope) of this DI instance.
   *
   * A fork is a fresh `DI` that delegates any unresolved key upward to its parent:
   * - Bindings registered **on the fork** are local to the fork and override the parent.
   * - Bindings registered **on the parent** are transparently resolved through the parent,
   *   returning the parent's cached singleton instance (so singletons are shared).
   * - The parent is **never** affected by `clear()` or `unbind()` on the fork.
   * - The fork can itself be forked, creating a chain of scopes.
   *
   * This is the primary pattern for per-request or per-test scoping:
   *
   * ```javascript
   * const appDI = new DI();
   * appDI.bind(DbPool, []);              // singleton, shared across all forks
   * appDI.bind(UserRepo, [DbPool]);      // singleton, shared
   *
   * // per HTTP request:
   * const reqDI = appDI.fork();
   * reqDI.bind(RequestContext, () => new RequestContext(req));
   * reqDI.bind(OrderService, [UserRepo, RequestContext]);
   *
   * const svc = reqDI.get(OrderService); // UserRepo resolved from parent (shared)
   *
   * // end of request — only the fork's local singletons are disposed:
   * reqDI.clear();
   * ```
   *
   * @returns A new `DI` instance whose parent is `this`.
   */
  fork(): DI;

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
   * Before removing each cached singleton instance, `dispose()` is called on it if the method
   * exists — giving services a chance to release resources (timers, connections, etc.).
   * Errors thrown by `dispose()` are silently ignored.
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

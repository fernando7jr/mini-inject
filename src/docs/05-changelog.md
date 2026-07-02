# Changelog

#### 1.13.4
* Added SECURITY.md
* Included github actions
* Executed `npm audit` and addressed all vulnerabilities

#### 1.13.3
* Small typescript interface correction

#### 1.13.2
* Fixed a critical bug in `di.clear()` where uninitialized Proxy instances (from `lateResolve: true`) were being eagerly instantiated just to check for a `dispose` method. Now, uninitialized proxies are correctly bypassed during clear.

#### 1.13.1
* Fixed `di.has()` and `di.getBinding()` not working for Container bindings.
* Fixed TypeScript overload resolution for `di.get()` when passing a Container. It now correctly infers `T[]` return type.
* Fixed the `get()` fallback behavior for Containers; it now correctly returns an empty array `[]` when `fallbackToEmptyList` is truthy and the container has no bindings, instead of returning `true`.

#### 1.13.0
* Added `Container` class — allows binding multiple injectables, factories, or tokens to a single container reference. When resolved, the container returns an array containing all resolved items.
* Individual container items retain their own configuration (e.g., `isSingleton`, `lateResolve`, `eager`).
* Improved `getAll` TypeScript typings using conditional resolution, accurately returning `T[]` when resolving a `Container<T>` while maintaining inference and backwards compatibility for existing tuple bindings.
* Officially documented the `eager: boolean` flag in both JSDoc and `README.md`, which is intended to eventually replace manual `lateResolve` flags.
* Container dependencies natively support resolving custom factory functions `(di) => T` for inline configurations.
* Updated `DependencyGraph` module to identify and report `Container` contents and their corresponding downstream dependencies.

#### 1.12.0
* Added `di.fork()` — creates a child `DI` instance that delegates unresolved keys to its parent; parent singletons are shared, fork-local bindings stay isolated, and `clear()` on the fork never touches the parent. Supports arbitrary fork depth
* Added `di.unbind(injectable)` — removes a single binding and its cached singleton instance; calls `dispose()` on the instance if the method exists, then removes both the binding and the cached value
* Added `{ eager: true }` option to `bind()` — when set on a singleton binding, the instance is created immediately at bind time instead of lazily on first `get()`; silently ignored for transient bindings
* `clear()` now calls `dispose()` on every cached singleton instance (and on sub-module instances recursively) before wiping the container, giving services a chance to release resources; errors thrown by `dispose()` are silently ignored
* Added `di.getDependencyGraph()` / `DI.getDependencyGraph(di)` — returns a serializable graph object (`{ nodes, edges, cycles }`) describing all registered bindings, their dependency descriptors, directed edges, and any detected circular-dependency cycles
* Added `di.formatDependencyGraph(opts?)` / `DI.formatDependencyGraph(graph, opts?)` — renders a dependency graph as a human-readable text report; pass `{ header: false }` to suppress the title and cycles-summary section
* Added `bin/analyze.mjs` CLI — run `npx mini-inject analyze <file>` to print a dependency report for any module that exports a `DI` instance; supports `--format=text|json`, `--export=<name>`, and `--no-header`
* Dep descriptors distinguish between `injectable` keys, `Literal<value>`, `Factory<name>`, and `null` (custom factory function — deps cannot be statically determined)
* Token keys are displayed as `Token<description>` in all outputs
* Bindings from attached sub-modules are included in the graph and marked with `isSubModule: true`
* New TypeScript types: `DepDescriptor`, `GraphNode`, `GraphEdge`, `DependencyGraph`, `FormatGraphOptions`

#### 1.11.0
* Added `DI.autoResolveCircularDependencies(true/false)` — global static flag that automatically detects and resolves circular dependencies at runtime for all instances, without needing any `lateResolve` flags on bindings
* Added `instance.autoResolveCircularDependencies(true/false)` — per-instance flag with the same behavior, only affecting that specific `DI` instance. The global flag takes precedence
* When neither auto mode nor `lateResolve` is used and a cycle is encountered, `get()` now throws a descriptive error listing the full dependency chain (e.g. `"Circular dependency detected: A → B → A"`) with instructions on how to fix it
* Updated TypeScript declarations and JSDoc for all affected methods

#### 1.10.1 and 1.10.2
* Improved `getAll` method signatures to use named parameters instead of tuple types
* Fixed TypeScript compatibility with the latest TypeScript versions
* Better type inference for `getAll` calls with 15+ parameters using spread syntax

#### 1.10
* Added the `clear()` method to reset DI containers, bindings, and sub-modules
* The `clear()` method recursively clears all sub-modules to ensure complete cleanup
* Useful for testing scenarios and reconfiguring the entire dependency injection container

#### 1.9
* Added support for Tokens through `di.token` method

#### 1.8
* Added factory for dependencies

#### 1.7
* Added sub-modules through the method `subModule`
* Added the method `has` to test if there is a binding for an injectable
* Binding now works without any parameters for constructable classes. Calling just `di.bind(A)` now works as if it were `di.bind(A, [])`

#### 1.6
* Added literals for dependencies

#### 1.5
* Binding with an empty dependency array now automatically set lateResolve flag to `false`
* Added the method `getBinding` for accessing the inner works of the library

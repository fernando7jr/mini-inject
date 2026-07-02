# Advanced Features

This section covers automatic circular dependency resolution, sub-modules, and isolated scoped containers (forks).

## Circular Dependencies

`mini-inject` provides multiple ways to resolve circular dependencies without throwing stack overflow errors.

### 1. Automatic Cycle Resolution (Recommended)
You can configure `mini-inject` to auto-detect circular references and resolve them transparently with lazy proxies:

```javascript
const {DI} = require('mini-inject');

class ServiceA {
    constructor(b) { this.b = b; }
    greet() { return `A (b is ${this.b.name})`; }
}

class ServiceB {
    constructor(a) { this.a = a; }
    get name() { return 'B'; }
    greet() { return `B (a is ${this.a.greet()})`; }
}

// Enable auto-resolution globally
DI.autoResolveCircularDependencies(true);

const di = new DI();
di.bind(ServiceA, (di) => new ServiceA(di.get(ServiceB)));
di.bind(ServiceB, (di) => new ServiceB(di.get(ServiceA)));

const a = di.get(ServiceA);
console.log(a instanceof ServiceA); // true
console.log(a.greet());             // A (b is B)
```

You can also enable it per-instance:
```javascript
const di = new DI();
di.autoResolveCircularDependencies(true);
```

### 2. Manual Late Resolve (`lateResolve: true`)
If auto-resolution is off, you can instruct `mini-inject` to proxy specific bindings:

```javascript
di.bind(A1, [A2], {lateResolve: true});
di.bind(A2, [A1]); // A2 will receive a late resolver Proxy for A1
```

### 3. Resolver Injection (`getResolver`)
You can inject a resolver function to retrieve dependencies lazily on-demand:

```javascript
di.bind(B1, [B2]);
di.bind(B2, [di.literal(di.getResolver(B1))]);

// Or using factory functions:
di.bind(B2, [di.factory((_di) => _di.getResolver(B1))]);
```

---

## Sub-Modules

Sub-modules allow you to modularize your dependency configurations. A parent container can look up bindings from attached sub-modules, but sub-modules cannot access parent container bindings.

```javascript
const {DI} = require('mini-inject');
const di = new DI();
class ParentService {}
di.bind(ParentService);

const sub = new DI();
class SubService {}
sub.bind(SubService);

// Attach the sub-module
di.subModule(sub);

// Parent can resolve both:
di.get(ParentService); // Works
di.get(SubService);    // Works (searched recursively in sub)

// Sub-module cannot resolve parent bindings:
sub.get(ParentService); // Throws 'No binding for injectable "ParentService"'
```

---

## Scoped Containers (Forks)

`di.fork()` creates a child container that inherits all parent bindings while maintaining its own isolated scope.

- **Local isolation**: Overrides and bindings defined on a fork never pollute the parent.
- **Shared Singletons**: Resolving a parent-bound singleton from a fork returns the same instance the parent holds.
- **Disposal**: Calling `fork.clear()` disposes only the fork's local singletons, leaving the parent container untouched.

This pattern is ideal for request scoping in web servers or test isolation.

```javascript
const appDI = new DI();
appDI.bind(DbPool, []);
appDI.bind(UserRepo, [DbPool]);

// Create request-scoped fork
const reqDI = appDI.fork();
reqDI.bind(RequestContext, () => new RequestContext(req));
reqDI.bind(OrderService, [UserRepo, RequestContext]);

// DB pool is shared with the main container
console.log(reqDI.get(DbPool) === appDI.get(DbPool)); // true

// Clear local request singletons at the end of the request
reqDI.clear();
```

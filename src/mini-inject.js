function isClass(f) {
    if (typeof f !== "function") return false;
    const prototype = Object.getOwnPropertyDescriptor(f, "prototype");
    if (!prototype) return false;
    return !prototype.writable;
}

function resolveKey(injectable) {
    if (!injectable)
        throw new Error(`Could not resolve injectable name from "${injectable}"`);
    else if (typeof injectable === "string" || injectable instanceof Symbol)
        return injectable;
    else if (injectable instanceof Token) return injectable.toSymbol();
    else if (injectable.name) return injectable.name;
    else if (injectable.toString && injectable.toString.apply)
        return injectable.toString();
    else if (injectable.constructor && injectable.constructor.name)
        return injectable.constructor.name;
    return new String(injectable);
}

class Token {
    #injectable;
    #description;
    #symbol; // Cache the symbol to avoid recreating it

    static for(injectable, description) {
        return new Token(injectable, description);
    }

    constructor(injectable, description) {
        this.#injectable = injectable;
        this.#description = resolveKey(description ?? injectable);
        // Use regular Symbol instead of Symbol.for to avoid global registry
        this.#symbol = Symbol(`__DIToken__[[${this.#description}]]`);
    }

    get value() {
        return this.#injectable;
    }

    toSymbol() {
        return this.#symbol;
    }
}

class DIProxyBuilder {
    #hasInstance = false;
    #__instance;
    /** @type {() => any} */
    #getter = null;
    #targetClass;

    constructor(getter, targetClass) {
        this.#getter = getter;
        this.#targetClass = targetClass;
    }

    #getInstance() {
        if (!this.#hasInstance) {
            this.#__instance = this.#getter();
            this.#hasInstance = true;
        }
        return this.#__instance;
    }

    build() {
        const getInstance = () => this.#getInstance();
        const className = this.#targetClass?.name || "Object";
        const shell = this.#targetClass?.prototype
            ? Object.create(this.#targetClass.prototype)
            : {};
        const handler = {
            get(target, prop, receiver) {
                if (prop === Symbol.toStringTag) {
                    return className;
                }

                const instance = getInstance();
                const value = Reflect.get(instance, prop, instance);
                if (typeof value === "function") {
                    return value.bind(instance);
                }
                return value;
            },
            set(_, prop, value, receiver) {
                return Reflect.set(getInstance(), prop, value, receiver);
            },
            has(_, prop) {
                return Reflect.has(getInstance(), prop);
            },
            ownKeys(_) {
                return Reflect.ownKeys(getInstance());
            },
            getOwnPropertyDescriptor(_, prop) {
                return Reflect.getOwnPropertyDescriptor(getInstance(), prop);
            },
            defineProperty(_, prop, descriptor) {
                return Reflect.defineProperty(getInstance(), prop, descriptor);
            },
            deleteProperty(_, prop) {
                return Reflect.deleteProperty(getInstance(), prop);
            },
            getPrototypeOf(target) {
                return Reflect.getPrototypeOf(target);
            },
            setPrototypeOf(target, proto) {
                return Reflect.setPrototypeOf(target, proto);
            },
            isExtensible(target) {
                return Reflect.isExtensible(target);
            },
            preventExtensions(target) {
                return Reflect.preventExtensions(target);
            },
        };
        // Use a shell object to preserve prototype checks while lazily resolving.
        return new Proxy(shell, handler);
    }

    dispose() {
        this.#getter = null;
        this.#__instance = null;
        this.#hasInstance = false;
    }
}

class DILiteral {
    /** @type {unknown} */
    #value = undefined;

    constructor(value) {
        this.#value = value;
    }

    get value() {
        return this.#value;
    }
}

class DIFactory {
    /** @type {(di: DI) => unknown} */
    #fn = undefined;

    constructor(fn) {
        this.#fn = fn;
    }

    /** @param {DI} di */
    get(di) {
        return this.#fn(di);
    }
}

class DI {
    /** @type {Map<string|Symbol, any>} */
    #container = new Map();
    /** @type {Map<string|Symbol, {func: Function, isSingleton: boolean, lateResolve: boolean, injectable: any}>} */
    #bindings = new Map();
    /** @type {DI[]} */
    #subModules = [];
    /** @type {Set<string|Symbol>} Keys currently mid-resolution in this call-stack */
    #resolving = new Set();
    /** @type {Map<string|Symbol, {instance: any}>} Resolver refs for auto-detected cycle proxies */
    #pendingProxies = new Map();
    /** @type {Array<string|Symbol>} Ordered stack of keys being resolved (used for cycle detection in normal mode) */
    #resolutionStack = [];
    /** @type {boolean} */
    #instanceAutoResolveCircular = false;

    /** @type {boolean} */
    static #autoResolveCircular = false;

    /**
     * When enabled globally, all DI instances ignore `lateResolve` and automatically
     * detect circular dependencies at resolution time. Opt-in; off by default.
     * Takes precedence over the instance-level setting.
     * @param {boolean} enabled
     */
    static autoResolveCircularDependencies(enabled) {
        DI.#autoResolveCircular = Boolean(enabled);
    }

    /**
     * When enabled on this instance, it ignores `lateResolve` and automatically
     * detects circular dependencies at resolution time, creating a Proxy only when
     * a cycle is actually encountered. Opt-in; off by default.
     * The global setting takes precedence over this instance-level setting.
     * @param {boolean} enabled
     */
    autoResolveCircularDependencies(enabled) {
        this.#instanceAutoResolveCircular = Boolean(enabled);
        return this;
    }

    #proxy(binding) {
        const getter = () => binding.func(this);
        return new DIProxyBuilder(getter, binding.injectable).build();
    }

    static literal(value) {
        return new DILiteral(value);
    }

    static factory(fn) {
        return new DIFactory(fn);
    }

    static token(injectable, description) {
        return Token.for(injectable, description);
    }

    literal(value) {
        return DI.literal(value);
    }

    factory(fn) {
        return DI.factory(fn);
    }

    token(injectable, description) {
        return DI.token(injectable, description);
    }

    getBinding(injectable) {
        const key = resolveKey(injectable);
        const binding = this.#bindings.get(key);
        if (!binding?.func) {
            for (const subModule of this.#subModules) {
                const subBinding = subModule.getBinding(injectable);
                if (subBinding) return subBinding;
            }
            return undefined;
        }
        return {
            isSingleton: Boolean(binding.isSingleton),
            lateResolve: Boolean(binding.lateResolve),
            resolveFunction: binding.func,
        };
    }

    has(injectable) {
        return Boolean(this.getBinding(injectable));
    }

    get(injectable, fallbackToValue) {
        const key = resolveKey(injectable);
        const binding = this.#bindings.get(key);

        if (!binding || !binding.func) {
            // First we try the subModules
            for (const subModule of this.#subModules) {
                if (subModule.has(injectable)) return subModule.get(injectable);
            }

            /* *
             * Fallback is only considered if it was provided as an argument
             * Omitting it means we should throw an error
             * Failing to resolve the injectable dependencies still gonna throw an error
             * */
            const isFallbackProvided = arguments.length > 1;
            if (isFallbackProvided) return fallbackToValue;
            throw new Error(`No binding for injectable "${key}"`);
        } else if (!binding.isSingleton) {
            return binding.func(this);
        } else if (!this.#container.has(key)) {
            if (DI.#autoResolveCircular || this.#instanceAutoResolveCircular) {
                if (this.#resolving.has(key)) {
                    // Cycle detected at runtime: create a Proxy now so the caller
                    // gets a valid (lazily-resolved) reference. The real instance
                    // will be set into resolverRef once the outer factory returns.
                    const resolverRef = {instance: undefined};
                    const proxy = new DIProxyBuilder(
                        () => resolverRef.instance,
                        binding.injectable,
                    ).build();
                    this.#container.set(key, proxy);
                    this.#pendingProxies.set(key, resolverRef);
                } else {
                    this.#resolving.add(key);
                    try {
                        const instance = binding.func(this);
                        if (this.#pendingProxies.has(key)) {
                            // A cycle proxy was created for this key during its own
                            // resolution. Wire the real instance into it and keep the
                            // Proxy as the singleton in the container.
                            this.#pendingProxies.get(key).instance = instance;
                            this.#pendingProxies.delete(key);
                        } else {
                            // No cycle: store the real instance directly.
                            this.#container.set(key, instance);
                        }
                    } finally {
                        this.#resolving.delete(key);
                        // If the factory threw after a proxy was already created,
                        // remove the dangling proxy so the key is re-resolvable.
                        if (this.#pendingProxies.has(key)) {
                            this.#pendingProxies.delete(key);
                            this.#container.delete(key);
                        }
                    }
                }
            } else if (binding.lateResolve) {
                this.#container.set(key, this.#proxy(binding));
            } else {
                if (this.#resolutionStack.includes(key)) {
                    const chain = [...this.#resolutionStack, key].map((k) => String(k)).join(' → ');
                    throw new Error(
                        `Circular dependency detected: ${chain}. ` +
                        `Use "lateResolve: true" on one of the bindings or enable ` +
                        `"autoResolveCircularDependencies" to resolve it automatically.`,
                    );
                }
                this.#resolutionStack.push(key);
                try {
                    const instance = binding.func(this);
                    this.#container.set(key, instance);
                } finally {
                    this.#resolutionStack.pop();
                }
            }
        }
        return this.#container.get(key);
    }

    getAll(...injectables) {
        return injectables.map((injectable) => this.get(injectable));
    }

    getResolver(injectable) {
        const _this = this;
        return {
            get() {
                return _this.get.call(_this, injectable, ...arguments);
            },
        };
    }

    bind(injectable, dep, opts) {
        const token = injectable;
        injectable = token instanceof Token ? token.value : injectable;

        const dependencies = !dep ? [] : Array.isArray(dep) ? dep : null;
        const dependenciesArrayIsEmpty = dependencies?.length === 0;
        if (dependencies && !injectable?.prototype?.constructor) {
            throw new Error(
                "Array of dependencies requires a constructable injectable",
            );
        }

        const func = (() => {
            if (dependencies) {
                /** @param {DI} di */
                return (di) => {
                    const resolvedDependencies = dependencies.map((d) => {
                        if (d instanceof DILiteral) return d.value;
                        else if (d instanceof DIFactory) return d.get(di);
                        return di.get(d);
                    });
                    if (!isClass(injectable))
                        return injectable.apply(injectable, resolvedDependencies);
                    return new injectable(...resolvedDependencies);
                };
            }
            return dep;
        })();

        const {isSingleton = true, lateResolve = false} = opts || {};
        const key = resolveKey(token);
        if (this.#container.has(key)) this.#container.delete(key);
        this.#bindings.set(key, {
            func,
            isSingleton,
            lateResolve: dependenciesArrayIsEmpty ? false : lateResolve,
            injectable,
        });
        return this;
    }

    subModule(...modules) {
        this.#subModules.push(...modules);
        return this;
    }

    removeSubModule(module) {
        const index = this.#subModules.indexOf(module);
        if (index > -1) {
            this.#subModules.splice(index, 1);
        }
        return this;
    }

    clear() {
        // Clear all sub-modules first
        for (const subModule of this.#subModules) {
            subModule.clear();
        }

        // Clear current instance containers
        this.#container.clear();
        this.#bindings.clear();
        this.#subModules.length = 0;
        this.#resolving.clear();
        this.#pendingProxies.clear();
        this.#resolutionStack.length = 0;
    }
}

// Export for both CommonJS and ES modules
export {DI, DILiteral, DIFactory, Token};

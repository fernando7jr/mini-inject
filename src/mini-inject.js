function isClass(f) {
    if (typeof f !== 'function') return false;
    const prototype = Object.getOwnPropertyDescriptor(f, 'prototype');
    if (!prototype) return false;
    return !prototype.writable;
}

function resolveKey(injectable) {
    if (!injectable) throw new Error(`Could not resolve injectable name from "${injectable}"`);
    else if (typeof injectable === 'string' || injectable instanceof Symbol) return injectable;
    else if (injectable instanceof Token) return injectable.toSymbol();
    else if (injectable.name) return injectable.name;
    else if (injectable.toString && injectable.toString.apply) return injectable.toString();
    else if (injectable.constructor && injectable.constructor.name) return injectable.constructor.name;
    return new String(injectable);
}

class Token {
    #injectable
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
    constructor(getter) {
        this.#getter = getter;
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
        const handler = {
            get(_, p) {
                return getInstance()[p];
            },
        };
        // Use an empty object instead of 'this' to avoid circular references
        return new Proxy({}, handler);
    }

    dispose() {
        this.#getter = null;
        this.#__instance = null;
        this.#hasInstance = false;
    }
}

// Experimental resolution strategy that creates a more debug-friendly wrapper
// The wrapper has the correct prototype and class information
// making it easier for debugging tools like Sentry to identify the real class
class DIExperimentalWrapper {
    #hasInstance = false;
    #__instance;
    /** @type {() => any} */
    #getter = null;
    #targetConstructor = null;
    
    constructor(getter, targetConstructor) {
        this.#getter = getter;
        this.#targetConstructor = targetConstructor;
    }

    #getInstance() {
        if (!this.#hasInstance) {
            this.#__instance = this.#getter();
            this.#hasInstance = true;
        }
        return this.#__instance;
    }

    // Create a wrapper that's more transparent for debugging
    // The wrapper object has the correct prototype and metadata
    build() {
        const self = this;
        
        // Create a target object with the correct prototype
        // This allows instanceof checks and helps debuggers identify the class
        const target = this.#targetConstructor && this.#targetConstructor.prototype
            ? Object.create(this.#targetConstructor.prototype)
            : {};
        
        // Add metadata to help debugging tools
        if (this.#targetConstructor) {
            // Store the constructor reference (non-configurable to prevent changes)
            Object.defineProperty(target, 'constructor', {
                enumerable: false,
                configurable: false,
                writable: false,
                value: this.#targetConstructor
            });
            
            // Add a Symbol.toStringTag for better toString() output
            if (this.#targetConstructor.name) {
                Object.defineProperty(target, Symbol.toStringTag, {
                    enumerable: false,
                    configurable: true,
                    get() {
                        return self.#targetConstructor.name;
                    }
                });
            }
        }
        
        // Use Proxy to forward property access to the real instance
        // But now the target has the correct prototype, making it more transparent
        return new Proxy(target, {
            get(targetObj, prop) {
                // Special case for 'constructor' - return the stored value
                if (prop === 'constructor') {
                    return targetObj.constructor;
                }
                
                // Get the real instance
                const instance = self.#getInstance();
                
                // Return the property from the instance
                const value = instance[prop];
                
                // If it's a function, bind it to the real instance
                if (typeof value === 'function') {
                    return value.bind(instance);
                }
                
                return value;
            },
            set(targetObj, prop, value) {
                const instance = self.#getInstance();
                instance[prop] = value;
                return true;
            },
            has(targetObj, prop) {
                if (prop === 'constructor') return true;
                const instance = self.#getInstance();
                return prop in instance;
            },
            ownKeys(targetObj) {
                const instance = self.#getInstance();
                return Reflect.ownKeys(instance);
            },
            getOwnPropertyDescriptor(targetObj, prop) {
                if (prop === 'constructor') {
                    return Object.getOwnPropertyDescriptor(targetObj, 'constructor');
                }
                const instance = self.#getInstance();
                return Object.getOwnPropertyDescriptor(instance, prop);
            },
            getPrototypeOf(targetObj) {
                const instance = self.#getInstance();
                return Object.getPrototypeOf(instance);
            }
        });
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
    /** @type {Map<string|Symbol, {func: Function, isSingleton: boolean, lateResolve: boolean, experimentalResolution: boolean, injectable: any}>} */
    #bindings = new Map();
    /** @type {DI[]} */
    #subModules = [];

    #proxy(binding) {
        const getter = () => binding.func(this);
        return new DIProxyBuilder(getter).build();
    }

    #experimentalWrapper(binding) {
        const getter = () => binding.func(this);
        // Pass the injectable constructor for better debugging
        const targetConstructor = binding.injectable;
        return new DIExperimentalWrapper(getter, targetConstructor).build();
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
            experimentalResolution: Boolean(binding.experimentalResolution),
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
            if (binding.lateResolve) {
                // Use experimental resolution if enabled, otherwise use Proxy
                if (binding.experimentalResolution) {
                    this.#container.set(key, this.#experimentalWrapper(binding));
                } else {
                    this.#container.set(key, this.#proxy(binding));
                }
            } else {
                const instance = binding.func(this);
                this.#container.set(key, instance);
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
            throw new Error('Array of dependencies requires a constructable injectable');
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
                    if (!isClass(injectable)) return injectable.apply(injectable, resolvedDependencies);
                    return new injectable(...resolvedDependencies);
                };
            }
            return dep;
        })();

        const {isSingleton = true, lateResolve = false, experimentalResolution = false} = opts || {};
        const key = resolveKey(token);
        if (this.#container.has(key)) this.#container.delete(key);
        this.#bindings.set(key, {
            func,
            isSingleton,
            lateResolve: dependenciesArrayIsEmpty ? false : lateResolve,
            experimentalResolution: lateResolve ? experimentalResolution : false, // Only valid when lateResolve is true
            injectable: token instanceof Token ? token.value : token, // Store the original injectable for debugging
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
    }
}

// Export for both CommonJS and ES modules
export { DI, DILiteral, DIFactory, Token };

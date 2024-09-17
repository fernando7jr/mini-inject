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

    static for(injectable, description) {
        return new Token(injectable, description);
    }

    constructor(injectable, description) {
        this.#injectable = injectable;
        this.#description = resolveKey(description ?? injectable);
    }

    get value() {
        return this.#injectable;
    }

    toSymbol() {
        return Symbol.for(`__DIToken__[[${this.#description}]]`);
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
        return new Proxy(this, handler);
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
    /** @type {Map<string|Symbol, {func: Function, isSingleton: boolean, lateResolve: boolean}>} */
    #bindings = new Map();
    /** @type {DI[]} */
    #subModules = [];

    #proxy(binding) {
        const getter = () => binding.func(this);
        return new DIProxyBuilder(getter).build();
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
            if (binding.lateResolve) {
                this.#container.set(key, this.#proxy(binding));
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

        const {isSingleton = true, lateResolve = false} = opts || {};
        const key = resolveKey(token);
        if (this.#container.has(key)) this.#container.delete(key);
        this.#bindings.set(key, {
            func,
            isSingleton,
            lateResolve: dependenciesArrayIsEmpty ? false : lateResolve,
        });
        return this;
    }

    subModule(...modules) {
        this.#subModules.push(...modules);
    }
}

module.exports = {DI, DILiteral, DIFactory, Token};

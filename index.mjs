function resolveKey(injectable) {
    if (!injectable) throw new Error(`Could not resolve injectable name from "${injectable}"`);
    else if (typeof injectable === 'string') return injectable;
    else if (injectable.name) return injectable.name;
    else if (injectable.toString && injectable.toString.apply) return injectable.toString();
    else if (injectable.constructor && injectable.constructor.name) return injectable.constructor.name;
    return new String(injectable);
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
            }
        };
        return new Proxy(this, handler);
    }
}

export class DI {
    #container = new Map();
    /** @type {Map<string, {func: Function, isSingleton: boolean, lateResolve: boolean}>} */
    #bindings = new Map();

    #proxy(binding) {
        const getter = () => binding.func(this);
        return new DIProxyBuilder(getter).build();
    }

    get(injectable) {
        const key = resolveKey(injectable);
        const binding = this.#bindings.get(key);
        if (!binding || !binding.func) throw new Error(`No binding for injectable "${key}"`);
        else if (!binding.isSingleton) return binding.func(this);
        else if (!this.#container.has(key)) {
            if (binding.lateResolve) {
                this.#container.set(key, this.#proxy(binding));
            } else {
                const instance = binding.func(this);
                this.#container.set(key, instance);
            }
        }
        return this.#container.get(key);
    }

    getResolver(injectable) {
        const _get = () => this.get(injectable);
        return {get: _get};
    }

    bind(injectable, func, opts) {
        const { isSingleton = true, lateResolve = false } = opts || {};
        const key = resolveKey(injectable);
        this.#bindings.set(key, {func, isSingleton, lateResolve});
        return this;
    }
}

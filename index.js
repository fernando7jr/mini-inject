function resolveKey(injectable) {
    if (!injectable) throw new Error(`Could not resolve injectable name from "${injectable}"`);
    else if (typeof injectable === 'string') return injectable;
    else if (injectable.name) return injectable.name;
    else if (injectable.toString && injectable.toString.apply) return injectable.toString();
    else if (injectable.constructor && injectable.constructor.name) return injectable.constructor.name;
    return new String(injectable);
}

module.exports.DI = class DI {
    #container = new Map();
    /** @type {Map<string, {func: Function, isSingleton: boolean}>} */
    #bindings = new Map();

    get(injectable) {
        const key = resolveKey(injectable);
        const binding = this.#bindings.get(key);
        if (!binding || !binding.func) throw new Error(`No binding for injectable "${key}"`);
        else if (!binding.isSingleton) return binding.func(this);
        else if (!this.#container.has(key)) {
            const instance = binding.func(this);
            this.#container.set(key, instance);
        }
        return this.#container.get(key);
    }

    bind(injectable, func, opts) {
        const { isSingleton = true } = opts || {};
        const key = resolveKey(injectable);
        this.#bindings.set(key, {func, isSingleton});
        return this;
    }
}

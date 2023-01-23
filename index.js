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
    #bindings = new Map();

    get(injectable) {
        const key = resolveKey(injectable);
        if (!this.#container.has(key)) {
            const constructor_ = this.#bindings.get(key);
            if (!constructor_) throw new Error(`No binding for injectable "${key}"`);
            const instance = constructor_(this);
            this.#container.set(key, instance);
        }
        return this.#container.get(key);
    }

    bind(injectable, func) {
        const key = resolveKey(injectable);
        this.#bindings.set(key, func);
        return this;
    }
}

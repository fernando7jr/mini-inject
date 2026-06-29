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

    get name() {
        return this.#fn?.name || null;
    }

    /** @param {DI} di */
    get(di) {
        return this.#fn(di);
    }
}

// ─── Dependency-graph helpers ────────────────────────────────────────────────

/**
 * Converts a raw binding key (string or Symbol) to a human-readable display string.
 * Token symbols are rendered as `Token<description>`.
 * @param {string|Symbol} key
 * @returns {string}
 */
function formatKey(key) {
    if (typeof key === 'string') return key;
    if (typeof key === 'symbol') {
        const desc = key.description ?? '';
        const match = desc.match(/^__DIToken__\[\[(.+)\]\]$/);
        if (match) return `Token<${match[1]}>`;
        return desc || String(key);
    }
    return String(key);
}

/**
 * Converts a raw dependency array (as stored in a binding) into DepDescriptor objects.
 * @param {Array} rawDeps
 * @returns {Array<{type:string, key?:string, value?:unknown, name?:string|null}>}
 */
function describeRawDeps(rawDeps) {
    return rawDeps.map((dep) => {
        if (dep instanceof DILiteral) return {type: 'literal', value: dep.value};
        if (dep instanceof DIFactory) return {type: 'factory', name: dep.name};
        return {type: 'injectable', key: formatKey(resolveKey(dep))};
    });
}

/**
 * DFS-based cycle detection over a directed graph described by nodes+edges.
 * Returns an array of cycles, each cycle being an array of keys where the first
 * key is repeated at the end: e.g. ["A","B","A"].
 * @param {{key:string}[]} nodes
 * @param {{from:string, to:string}[]} edges
 * @returns {string[][]}
 */
function detectCycles(nodes, edges) {
    const adj = new Map();
    for (const node of nodes) adj.set(node.key, []);
    for (const edge of edges) {
        const neighbors = adj.get(edge.from);
        if (neighbors) neighbors.push(edge.to);
    }

    // Tarjan's SCC — correctly identifies all strongly-connected components
    // regardless of traversal order, avoiding the missed-cycle bug of simple DFS.
    const nodeIndex = new Map();
    const lowlink = new Map();
    const onStack = new Set();
    const stack = [];
    let counter = 0;
    const sccOf = new Map(); // key → scc array (only for non-trivial SCCs)
    const nonTrivialSccs = [];

    const strongconnect = (v) => {
        nodeIndex.set(v, counter);
        lowlink.set(v, counter);
        counter++;
        stack.push(v);
        onStack.add(v);
        for (const w of adj.get(v) || []) {
            if (!nodeIndex.has(w)) {
                strongconnect(w);
                lowlink.set(v, Math.min(lowlink.get(v), lowlink.get(w)));
            } else if (onStack.has(w)) {
                lowlink.set(v, Math.min(lowlink.get(v), nodeIndex.get(w)));
            }
        }
        if (lowlink.get(v) === nodeIndex.get(v)) {
            const scc = [];
            let w;
            do {
                w = stack.pop();
                onStack.delete(w);
                scc.push(w);
            } while (w !== v);
            const hasSelfLoop = (adj.get(v) || []).includes(v);
            if (scc.length > 1 || hasSelfLoop) {
                scc.reverse(); // restore discovery order (stack pops in reverse)
                nonTrivialSccs.push(scc);
                for (const key of scc) sccOf.set(key, scc);
            }
        }
    };

    for (const node of nodes) {
        if (!nodeIndex.has(node.key)) strongconnect(node.key);
    }

    // For each non-trivial SCC, extract one representative cycle path (start key repeated at end)
    const cycles = [];
    for (const scc of nonTrivialSccs) {
        const sccSet = new Set(scc);
        const sccAdj = new Map();
        for (const v of scc) {
            sccAdj.set(v, (adj.get(v) || []).filter((w) => sccSet.has(w)));
        }
        const start = scc[0];
        const path = [];
        const visited = new Set();
        const findCycle = (v) => {
            if (v === start && path.length > 0) {
                cycles.push([...path, start]);
                return true;
            }
            if (visited.has(v)) return false;
            visited.add(v);
            path.push(v);
            for (const w of sccAdj.get(v) || []) {
                if (findCycle(w)) return true;
            }
            path.pop();
            return false;
        };
        findCycle(start);
    }

    return {cycles, sccOf};
}

/**
 * Formats a single DepDescriptor as a concise display string for text output.
 * @param {{type:string, key?:string, value?:unknown, name?:string|null}} dep
 * @returns {string}
 */
function formatDepText(dep) {
    if (dep.type === 'injectable') return dep.key;
    if (dep.type === 'literal') {
        let val;
        try {
            val = JSON.stringify(dep.value);
            if (val.length > 20) val = val.slice(0, 17) + '...';
        } catch {
            val = String(dep.value);
        }
        return `Literal<${val}>`;
    }
    if (dep.type === 'factory') {
        return dep.name ? `Factory<${dep.name}>` : 'Factory<anonymous>';
    }
    return '?';
}

/**
 * Renders a DependencyGraph as a human-readable text report.
 * @param {{nodes:any[], edges:any[], cycles:string[][]}} graph
 * @param {{header?:boolean}} [opts]
 * @returns {string}
 */
function formatGraphText(graph, opts) {
    const {header = true} = opts || {};
    const lines = [];

    if (header) {
        const title = `mini-inject dependency graph — ${graph.nodes.length} binding(s), ${graph.cycles.length} cycle(s)`;
        lines.push(title);
        lines.push('═'.repeat(title.length));
        lines.push('');
    }

    const maxKeyLen = Math.max(4, ...graph.nodes.map((n) => n.key.length));

    // Map each node key to the first cycle string it participates in
    const nodeToCycle = new Map();
    for (const cycle of graph.cycles) {
        const cycleStr = cycle.join(' → ');
        for (const key of cycle.slice(0, -1)) {
            if (!nodeToCycle.has(key)) nodeToCycle.set(key, cycleStr);
        }
    }

    for (const node of graph.nodes) {
        const keyCol = node.key.padEnd(maxKeyLen);
        const singletonCol = node.isSingleton ? '[singleton]' : '[transient]';
        const lateCol = node.lateResolve ? '  lateResolve' : '             ';
        let depsCol;
        if (node.deps === null) {
            depsCol = '(custom initializer - unknown deps)';
        } else if (node.deps.length === 0) {
            depsCol = '';
        } else {
            depsCol = node.deps.map(formatDepText).join(', ');
        }
        const cycleStr = nodeToCycle.get(node.key);
        const cycleCol = cycleStr ? `  ⚠ CYCLE: ${cycleStr}` : '';
        lines.push(`${keyCol}  ${singletonCol}${lateCol}  ${depsCol}${cycleCol}`);
    }

    if (header && graph.cycles.length > 0) {
        lines.push('');
        lines.push('Cycles detected:');
        graph.cycles.forEach((cycle, i) => {
            lines.push(`  [${i + 1}] ${cycle.join(' → ')}`);
        });
    }

    return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────────────────────

class DI {
    /** @type {Map<string|Symbol, any>} */
    #container = new Map();
    /** @type {Map<string|Symbol, {func: Function, isSingleton: boolean, lateResolve: boolean, injectable: any}>} */
    #bindings = new Map();
    /** @type {DI[]} */
    #subModules = [];
    /** @type {DI | null} Parent DI instance when this is a fork */
    #parent = null;
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
            if (this.#parent) return this.#parent.getBinding(injectable);
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

            // Then delegate to the parent (if this is a fork)
            if (this.#parent && this.#parent.has(injectable)) {
                return this.#parent.get(injectable);
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

    /**
     * Build a dependency graph for this DI module (and any attached sub-modules).
     * Bindings declared with an array of dependencies are fully described; bindings
     * declared with a custom factory function are marked with `deps: null`.
     * @returns {{nodes: any[], edges: any[], cycles: string[][]}}
     */
    getDependencyGraph() {
        return DI.getDependencyGraph(this);
    }

    /**
     * Build a dependency graph for the given DI module.
     * @param {DI} di
     * @returns {{nodes: any[], edges: any[], cycles: string[][]}}
     */
    static getDependencyGraph(di) {
        const nodes = [];
        const nodeKeySet = new Set();

        function collect(diInstance, isSubModule) {
            for (const [key, binding] of diInstance.#bindings) {
                const displayKey = formatKey(key);
                if (nodeKeySet.has(displayKey)) continue; // parent takes precedence
                nodeKeySet.add(displayKey);
                nodes.push({
                    key: displayKey,
                    isSingleton: binding.isSingleton,
                    lateResolve: binding.lateResolve,
                    isSubModule,
                    deps: binding.rawDeps !== null ? describeRawDeps(binding.rawDeps) : null,
                });
            }
            for (const sub of diInstance.#subModules) {
                collect(sub, true);
            }
        }

        collect(di, false);

        // Build edges — only between known nodes, deduped
        const edges = [];
        const edgeSeen = new Set();
        for (const node of nodes) {
            if (!node.deps) continue;
            for (const dep of node.deps) {
                if (dep.type !== 'injectable') continue;
                if (!nodeKeySet.has(dep.key)) continue;
                const edgeKey = JSON.stringify([node.key, dep.key]);
                if (edgeSeen.has(edgeKey)) continue;
                edgeSeen.add(edgeKey);
                edges.push({from: node.key, to: dep.key, isCircular: false});
            }
        }

        // Detect cycles then mark affected edges
        // An edge is circular iff both endpoints belong to the same non-trivial SCC.
        const {cycles, sccOf} = detectCycles(nodes, edges);
        for (const edge of edges) {
            const fromScc = sccOf.get(edge.from);
            edge.isCircular = fromScc !== undefined && fromScc === sccOf.get(edge.to);
        }

        return {nodes, edges, cycles};
    }

    /**
     * Render the dependency graph of this module as a human-readable text report.
     * @param {{header?: boolean}} [opts]
     * @returns {string}
     */
    formatDependencyGraph(opts) {
        return DI.formatDependencyGraph(this.getDependencyGraph(), opts);
    }

    /**
     * Render a pre-computed dependency graph as a human-readable text report.
     * @param {{nodes: any[], edges: any[], cycles: string[][]}} graph
     * @param {{header?: boolean}} [opts]
     * @returns {string}
     */
    static formatDependencyGraph(graph, opts) {
        return formatGraphText(graph, opts);
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

        const {isSingleton = true, lateResolve = false, eager = false} = opts || {};
        const key = resolveKey(token);
        if (this.#container.has(key)) this.#container.delete(key);
        this.#bindings.set(key, {
            func,
            isSingleton,
            lateResolve: dependenciesArrayIsEmpty ? false : lateResolve,
            injectable,
            rawDeps: dependencies,
        });
        if (eager && isSingleton) this.get(token);
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

    fork() {
        const child = new DI();
        child.#parent = this;
        return child;
    }

    #disposeInstance(instance) {
        if (instance && typeof instance.dispose === 'function') {
            try {
                instance.dispose();
            } catch {
                // ignore errors from dispose
            }
        }
    }

    unbind(injectable) {
        const key = resolveKey(injectable);
        if (this.#container.has(key)) {
            this.#disposeInstance(this.#container.get(key));
            this.#container.delete(key);
        }
        this.#bindings.delete(key);
        return this;
    }

    clear() {
        // Clear all sub-modules first
        for (const subModule of this.#subModules) {
            subModule.clear();
        }

        // Dispose all cached singleton instances
        for (const instance of this.#container.values()) {
            this.#disposeInstance(instance);
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

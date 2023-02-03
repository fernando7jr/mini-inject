export type ClassType = (Function | Object) & { name: string; };
export type ClassConstructor<T> = ClassType & { new(...args: any): T; };
export type Injectable<T> = ClassConstructor<T> | string;
export type BindingFunc<T> = (di: DI) => T;

/**
 * A resolver object which is mapped to an specific binding
 */
export interface DIResolver<T> {
    /**
     * Get an instance for the previously class binding
     * @returns an instance of T
     */
    get(): T;
}

/**
 * Minimalistic class for dependency injection
 */
export class DI { 

    /**
     * Get an instance for the previously class binding
     * @param injectable an injectable class or a string key-value used for the binding
     * @returns an instance of T
     */
    get<T>(injectable: Injectable<T>): T;

    /**
     * Get an object with a method to get an instance of the class binding
     * @param injectable an injectable class or a string key-value used for the binding
     * @returns an object that resolves to an instance of T
     */
    getResolver<T>(injectable: Injectable<T>): DIResolver<T>;

    /**
     * Bind a class or another constructable object so it can be fetched later
     * @param injectable an injectable class or a string key-value used for the binding
     * @param func the function called when it should instanciate the object
     * @param opts.isSingleton optional param to specify that this injectable is a singleton (only one instance can exist). It is true by default
     * @param opts.lateResolve optional param to specify that this injectable should be resolved later. This means that instanciation will happen later when it is used. This avoids circular dependency problems. It is false by default
     * @returns this
     */
    bind<T>(injectable: Injectable<T>, func: BindingFunc<T>, opts?: {isSingleton?: boolean, lateResolve?: boolean}): this;
}

export type DIGetter = Pick<DI, 'get' | 'getResolver'>;

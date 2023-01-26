export type ClassType = (Function | Object) & { name: string; };
export type ClassConstructor<T> = ClassType & { new(...args: any): T; };
export type Injectable<T> = ClassConstructor<T> | string;
export type BindingFunc<T> = (di: DI) => T;

/**
 * Minimalistic class for dependency injection
 */
export class DI {

    /**
     * Get an instance for the previously class binding
     * @param {Injectable<T>} injectable an injectable class or a string key-value used for the binding
     * @returns {T} an unique instance of T
     */
    get<T>(injectable: Injectable<T>): T;

    /**
     * Bind a class or another constructable object so it can be fetched later
     * @param {Injectable<T>} injectable an injectable class or a string key-value used for the binding
     * @param {BindingFunc<T>} func the function called when it should instanciate the object
     * @param {object} opts optional params for customizing the injection
     * @param {boolean} opts.isSingleton optional param to specify that this injectable is a singleton (only one instance can exist). It is true by default
     * @returns {this} this
     */
    bind<T>(injectable: Injectable<T>, func: BindingFunc<T>, opts?: {isSingleton: boolean}): this;
}

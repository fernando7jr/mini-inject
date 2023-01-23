export type ClassType = (Function | Object) & { name: string; };
export type ClassConstructor<T> = ClassType & { new(...args: any): T; };
export type BindingFunc<T> = (di: DI) => T;

/**
 * Minimalistic class for dependency injection
 */
export class DI {

    /**
     * Get an instance for the previously class binding
     * @param {ClassConstructor<T> | string} injectable an injectable class or a string key-value used for the binding
     * @returns {T} an unique instance of T
     */
    get<T>(injectable: ClassConstructor<T> | string): T;

    /**
     * Bind a class or another constructable object so it can be fetched later
     * @param {ClassConstructor<T> | string} injectable an injectable class or a string key-value used for the binding
     * @param {BindingFunc<T>} func the function called when it should instanciate the object
     * @returns {this} this
     */
    bind<T>(injectable: ClassConstructor<T> | string, func: BindingFunc<T>): this;
}

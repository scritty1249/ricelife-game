import { LoadPool } from "./LoadPool.js";

export class AssetPool extends LoadPool {
    // expects:
    // key: String, args: [constructorFn, callbackFn | undefined, ...constructorArgs], ...
    add (...kwargs) {
        if (!kwargs?.length) return Promise.resolve();
        const keys = new Set();
        const entries = [];
        for (let i = 0; i < kwargs.length; i+=2) {
            const key = kwargs[i];
            const args = kwargs[i+1];
            const type = args.shift();
            const callback = args.shift();
            const promise = type(...args).onload
            keys.add(key);
            if (callback) promise.then(callback);
            entries.push(key, promise);
        }
        super.add(...entries);
        return Promise.all(keys.values().map((key) => this.onready(key)));
    }

    get isAssetPool () { return true }
}
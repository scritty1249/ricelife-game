export function isThenable (obj) {
    return (obj
        && typeof obj?.then === "function"
        && typeof obj?.catch === "function"
        && typeof obj?.finally === "function"
    );
}

export function isAwaiting (onFulfilled) {
    return typeof onFulfilled === "function"
        && !onFulfilled.name
        && onFulfilled.toString().includes("[native code]");
}
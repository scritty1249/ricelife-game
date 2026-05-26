export function uuid () { return crypto.randomUUID() }

export class TrackableObject {
    #id;
    constructor() {
        this.#id = uuid();
    }
    get id () { return this.#id };
}

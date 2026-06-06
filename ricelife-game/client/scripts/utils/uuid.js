export function uuid () { return crypto.randomUUID() }

export class TrackableObject {
    #id;
    constructor() {
        this.#id = uuid();
    }
    eq (other) { return other?.id && other?.id === this.id }
    get id () { return this.#id };
}

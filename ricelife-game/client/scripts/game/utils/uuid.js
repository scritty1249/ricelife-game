export function uuid () { return crypto.randomUUID() }

export const HASH_BASE = 0x811c9dc5; // FNV-1a hash algorithm
export class TrackableObject {
    #id;
    constructor() {
        this.#id = uuid();
    }
    eq (other) { return other?.id && other?.id === this.id }
    get id () { return this.#id };
}

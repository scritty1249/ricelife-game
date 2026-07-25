import { generateUUID } from "./UUID.js";

export class TrackableObject {
    #id;
    constructor (id = null) {
        this.#id = id === null || id === undefined ? generateUUID() : id;
    }
    eq (other) { return other?.id && other?.id === this.id }
    get id () { return this.#id };
}

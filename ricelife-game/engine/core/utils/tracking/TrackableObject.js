import { generateUUID } from "./UUID.js";

export class TrackableObject {
    #id;
    constructor() {
        this.#id = generateUUID();
    }
    eq (other) { return other?.id && other?.id === this.id }
    get id () { return this.#id };
}

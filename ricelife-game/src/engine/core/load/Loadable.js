import { Identifiable } from "../utils/tracking/Identifiable.js";

export class Loadable extends Identifiable {
    constructor () { super() }
    get isLoadable () { return true }
    get ready () { return true }
    get onload () { return Promise.resolve(this) }   
    get source () { return undefined }
}

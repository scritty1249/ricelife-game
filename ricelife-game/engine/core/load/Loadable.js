import { TrackableObject } from "../utils/tracking/TrackableObject.js";

export class Loadable extends TrackableObject {
    constructor () { super() }
    get isLoadable () { return true }
    get ready () { return true }
    get onload () { return Promise.resolve(this) }   
    get source () { return undefined }
}

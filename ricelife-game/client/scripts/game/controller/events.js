// event listeners for enviroments without a DOM
export class EventController {
    static #DEFAULT_EVENT_OPTIONS = {
        once: false
    };
    #events = {};
    constructor () {}

    #registerEventType (event) { this.#events[event] = new Map() }

    addEventListener (event, callback, options = {}) {
        if (!(event in this.#events)) {
            this.#registerEventType(event);
        }
        this.#events[event].set(callback,
            {
                ...EventController.#DEFAULT_EVENT_OPTIONS,
                ...(typeof options === "object" ? options : {})
            });
    }
    removeEventListener (event, callback) {
        return this.#events[event]?.delete?.(callback);
    }
    raiseEvent (event, data) {
        if (!(event in this.#events)) return;
        const d = typeof data === "object" ? data : {};
        this.#events[event].forEach((options, callback) => {
            callback?.(d);
            if (options?.once)
                this.removeEventListener(callback);
        });
    }
    getEventDescriptors () {
        const events = {};
        for ( const [ event, {size} ] of Object.entries(this.#events[events])) {
            events[event] = {
                listeners: size
            };
        }
        return events;
    }

    get isEventController () { return true }
    get events () { return Object.keys(this.#events) }
}

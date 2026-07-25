// event listeners for enviroments without a DOM
export class EventMap {
    static #DEFAULT_EVENT_OPTIONS = {
        once: false
    };
    #events = {};
    #size = 0;
    constructor () {}

    #registerEventType (event) { this.#events[event] = new Map() }

    addEventListener (event, callback, options = {}) {
        if (!(event in this.#events)) {
            this.#registerEventType(event);
        }
        const oldSize = this.#events[event].size;
        this.#events[event].set(callback,
            {
                ...EventController.#DEFAULT_EVENT_OPTIONS,
                ...(typeof options === "object" ? options : {})
            });
        if (oldSize !== this.#events[event].size) this.#size++;
    }
    removeEventListener (event, callback) {
        const result = this.#events[event]?.delete?.(callback);
        if (result) {
            this.#size--;
            if (!this.#events[event].size)
                delete this.#events[event];
        }
        return result;
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
    reset () {
        this.#events = {};
        this.#size = 0;
    }

    get isEventMap () { return true }
    get events () { return Object.keys(this.#events) }
    get size () { return this.#size }
}

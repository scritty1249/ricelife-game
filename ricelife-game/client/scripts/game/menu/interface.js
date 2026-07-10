import { TrackableObject } from "../utils/utils.js";

// Manages layers of clickable objects on the canvas
export class Interface { // pointer events are prioritized in FIFO order
    #layers = new Array();
    constructor (...layers) {
        this.push(...layers);
    }

    *#iterate (start = 0, end = -1, reverse = true) {
        const stop = (end < 0) ? (end === -1 ? this.length : this.length + (end % this.length)) : end;
        if (reverse) for (let i = stop - 1; i >= start; i--) yield this.layer(i);
        else for (let i = start; i < stop; i++) yield this.layer(i);
    }

    layer (index) { return this.#layers.at(index) }
    insert (index = -1) {
        const layer = new InterfaceLayer();
        if (index === -1) this.#layers.push(layer);
        else this.#layers.splice(index, 0, layer);
        return layer; // for chaining
    }
    push (...layers) {
        for (const layer of layers) {
            if (!layer?.isInterfaceLayer) throw new Error("[Interface] Error: Cannot add non-layer object " + (typeof layer));
            this.#layers.push(layer);
        }
    }
    ondrag (point, origin) {
        let item = undefined;
        for (const layer of this.#iterate())
            if ((item = layer.isDragged(origin)) !== undefined) break;
        if (item !== undefined) item.ondrag(point);
    }
    onhold (point) {
        let item = undefined;
        for (const layer of this.#iterate())
            if ((item = layer.isHeld(point)) !== undefined) break;
        if (item !== undefined) item.onhold(point);
    }
    onpress (point) {
        let item = undefined;
        for (const layer of this.#iterate())
            if ((item = layer.isPressed(point)) !== undefined) break;
        if (item !== undefined) item.onpress(point);
    }
    onrelease (point, delta) {
        let item = undefined;
        for (const layer of this.#iterate())
            if ((item = layer.isReleased(point)) !== undefined) break;
        if (item !== undefined) item.onrelease(point, delta);
    }
    onclick (point, pressed) {
        let item = undefined;
        for (const layer of this.#iterate())
            if ((item = layer.isClicked(point, pressed)) !== undefined) break;
        if (item !== undefined) item.onclick(point);
    }
    draw (cursor, start = 0, end = -1) { for (const layer of this.#iterate(start, end, false)) layer.draw(cursor) }
    slice (start = 0, end = -1) { return new Interface(...this.#layers.slice(start, end)) }
    *[Symbol.iterator]() {
        yield *this.#layers;
    }

    get isInterface () { return true }
    get length () { return this.#layers.length }
}

// [!] may be excessive. Just a glorified map with some bells + whistles (not even shiny ones) - KT
class InterfaceLayer extends TrackableObject { // pointer events are prioritized in FIFO order
    #items = new Map();
    constructor (...items) {
        super();
        this.push(...items);
    }

    push (...items) {
        for (const item of items) {
            if (!item?.id) throw new Error("[InterfaceLayer] Error: Cannot add untrackable object of type " + (typeof item) + " to interface layer");
            if (this.has(item)) throw new Error("[InterfaceLayer] Error: Cannot add item to layer - item " + item.id + " already exists");
            this.#items.set(item.id, item);
        }
    }
    has (item) {
        return (item?.id)
            ? this.#items.has(item.id)
            : false;
    }
    get (id) {
        return this.#items.get(id);
    }
    isClicked (point, pressed) {
        for (const item of this.items) {
            if (
                this.#supportsCursorEvents(item)
                && this.#supportsClickEvents(item)
                && item.isOver(point)
                && (!pressed || item.isOver(pressed))
            ) return item;
        }
        return undefined;
    }
    isDragged (origin) {
        for (const item of this.items) {
            if (
                this.#supportsCursorEvents(item)
                && this.#supportsDragEvents(item)
                && item.isOver(origin)
            ) return item;
        }
        return undefined;
    }
    isHeld (point) {
        for (const item of this.items) {
            if (
                this.#supportsCursorEvents(item)
                && this.#supportsHoldEvents(item)
                && item.isOver(point)
            ) return item;
        }
        return undefined;
    }
    isPressed (point) {
        for (const item of this.items) {
            if (
                this.#supportsCursorEvents(item)
                && this.#supportsPressEvents(item)
                && item.isOver(point)
            ) return item;
        }
        return undefined;
    }
    isReleased (point) {
        for (const item of this.items) {
            if (
                this.#supportsCursorEvents(item)
                && this.#supportsReleaseEvents(item)
                && item.isOver(point)
            ) return item;
        }
        return undefined;
    }
    isOver (point) {
        for (const item of this.items) {
            if (
                this.#supportsCursorEvents(item)
                && item.isOver(point)
            ) return item;
        }
        return undefined;
    }
    draw (cursor) {
        for (const item of this.#items.values())
            if (this.#supportsDraw(item))
                item.draw(cursor);
    }

    #supportsDraw (item) { return typeof item?.draw === "function" }
    #supportsCursorEvents (item) { return typeof item?.isOver === "function" }
    #supportsClickEvents (item) { return typeof item?.onclick === "function" }
    #supportsHoldEvents (item) { return typeof item?.onhold === "function" }
    #supportsDragEvents (item) { return typeof item?.ondrag === "function" }
    #supportsPressEvents (item) { return typeof item?.onpress === "function" }
    #supportsReleaseEvents (item) { return typeof item?.onrelease === "function" }

    get isInterfaceLayer () { return true }
    get items () { return [...this.#items.values()].reverse() } // [!] reverse call causes lag / horribly inefficient
    get size () { return this.#items.size }
}

import { TrackableObject } from "../utils/utils.js";

// Manages layers of clickable objects on the canvas
export class Interface { // pointer events are prioritized in FIFO order
    #viewbox;
    #layers = new Array();
    constructor (viewbox, ...layers) {
        this.push(...layers);
        this.viewbox = viewbox;
    }

    *#iterate (start = 0, end = -1, reverse = true) {
        const stop = (end < 0) ? (end === -1 ? this.length : this.length + (end % this.length)) : end;
        if (reverse) for (let i = stop - 1; i >= start; i--) yield this.layer(i);
        else for (let i = start; i < stop; i++) yield this.layer(i);
    }

    layer (index) { return this.#layers.at(index) }
    insert (index = -1) {
        const layer = new InterfaceLayer(this.viewbox);
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
    // returns null if dragging was broken on an item
    ondrag (point, origin, delta) {
        let item = undefined;
        let layer = undefined;
        let keepFocus;
        for (let i = this.length - 1; i >= 0 && item === undefined; i--) {
            layer = this.#layers[i];
            const over = layer.isOver(origin);
            item = over?.keepDragFocus ? over : layer.isDragged(point, origin);
            if (item !== undefined) {
                if (!item.keepDragFocus) {
                    for (let j = i + 1; j < this.length; j++) {
                        const l = this.#layers[j];
                        if (l.isOver(point) || l.isOver(origin)) return null;
                    }
                }
            }
        }
        if (item !== undefined) item.ondrag(layer.parseCoordinate(point), layer.parseCoordinate(origin), delta);
    }
    onhold (point) {
        let item = undefined;
        let layer = undefined;
        for (const l of this.#iterate()) {
            layer = l;
            if ((item = layer.isHeld(point)) !== undefined) break;
        }
        if (item !== undefined) item.onhold(layer.parseCoordinate(point));
    }
    onpress (point) {
        let item = undefined;
        let layer = undefined;
        for (const l of this.#iterate()) {
            layer = l;
            if ((item = layer.isPressed(point)) !== undefined) break;
        }
        if (item !== undefined) item.onpress(layer.parseCoordinate(point));
    }
    onrelease (point, delta) {
        let item = undefined;
        let layer = undefined;
        for (const l of this.#iterate()) {
            layer = l;
            if ((item = layer.isReleased(point)) !== undefined) break;
        }
        if (item !== undefined) item.onrelease(layer.parseCoordinate(point), delta);
    }
    onclick (point, delta) {
        let item = undefined;
        let layer = undefined;
        for (const l of this.#iterate()) {
            layer = l;
            if ((item = layer.isClicked(point, delta)) !== undefined) break;
        }
        if (item !== undefined) item.onclick(layer.parseCoordinate(point));
    }
    onscroll (point, delta) {
        let item = undefined;
        let layer = undefined;
        for (const l of this.#iterate()) {
            layer = l;
            if ((item = layer.isScrolled(point)) !== undefined) break;
        }
        if (item !== undefined) item.onscroll(layer.parseCoordinate(point), delta);
    }
    draw (cursor, start = 0, end = -1) { for (const layer of this.#iterate(start, end, false)) layer.draw(cursor) }
    slice (start = 0, end = -1) { return new Interface(this.viewbox, ...this.#layers.slice(start, end)) }
    *[Symbol.iterator]() {
        yield *this.#layers;
    }

    get isInterface () { return true }
    get length () { return this.#layers.length }
    get viewbox () { return this.#viewbox }
    set viewbox (viewbox) {
        if (!viewbox?.isViewbox) throw new Error(`[${this.constructor.name}]: Viewbox expected, got ${typeof viewbox}`);
        for (const layer of this.#layers) layer.viewbox = viewbox;
        return (this.#viewbox = viewbox);
    }
}

// [!] may be excessive. Just a glorified map with some bells + whistles (not even shiny ones) - KT
class InterfaceLayer extends TrackableObject { // pointer events are prioritized in FIFO order
    #viewbox;
    #items = new Map();
    fixed = false; // when true, coordinates from pointer events and drawing will be interpreted relative to the viewbox, instead of global space
    constructor (viewbox, ...items) {
        super();
        this.push(...items);
        this.viewbox = viewbox;
    }

    // set to relative coordinate if viewbox cursor is set, otherwise return the same point
    parseCoordinate (point) {
        return this.fixed || !point?.isVector ? point : this.viewbox.toGlobal(point, false);
    }
    push (...items) {
        for (const item of items) {
            if (!item?.id) throw new Error(`[${this.constructor.name}]: Cannot add untrackable object of type ${typeof item} to interface layer`);
            if (this.has(item)) throw new Error(`[${this.constructor.name}]: Cannot add item to layer - item ${item.id} already exists`);
            this.#items.set(item.id, item);
        }
        return this; // for chaining
    }
    has (item) {
        return (item?.id)
            ? this.#items.has(item.id)
            : false;
    }
    get (id) {
        return this.#items.get(id);
    }
    isClicked (point, delta) {
        const pt = this.parseCoordinate(point);
        const pr = this.parseCoordinate(point.sub(delta));
        for (const item of this.items) {
            if (
                this.#supportsCursorEvents(item)
                && this.#supportsClickEvents(item)
                && item.isOver(pt)
                && (!pr || item.isOver(pr))
            ) return item;
        }
        return undefined;
    }
    isDragged (point, origin) {
        const pt = this.parseCoordinate(point);
        const og = this.parseCoordinate(origin);
        for (const item of this.items) {
            if (
                this.#supportsCursorEvents(item)
                && this.#supportsDragEvents(item)
                && item.isOver(pt)
                && item.isOver(og)
            ) return item;
        }
        return undefined;
    }
    isHeld (point) {
        const pt = this.parseCoordinate(point);
        for (const item of this.items) {
            if (
                this.#supportsCursorEvents(item)
                && this.#supportsHoldEvents(item)
                && item.isOver(pt)
            ) return item;
        }
        return undefined;
    }
    isPressed (point) {
        const pt = this.parseCoordinate(point);
        for (const item of this.items) {
            if (
                this.#supportsCursorEvents(item)
                && this.#supportsPressEvents(item)
                && item.isOver(pt)
            ) return item;
        }
        return undefined;
    }
    isReleased (point) {
        const pt = this.parseCoordinate(point);
        for (const item of this.items) {
            if (
                this.#supportsCursorEvents(item)
                && this.#supportsReleaseEvents(item)
                && item.isOver(pt)
            ) return item;
        }
        return undefined;
    }
    isScrolled (point) {
        const pt = this.parseCoordinate(point);
        for (const item of this.items) {
            if (
                this.#supportsCursorEvents(item)
                && this.#supportsScrollEvents(item)
                && item.isOver(pt)
            ) return item;
        }
        return undefined;
    }
    isOver (point) {
        const pt = this.parseCoordinate(point);
        for (const item of this.items) {
            if (
                this.#supportsCursorEvents(item)
                && item.isOver(pt)
            ) return item;
        }
        return undefined;
    }
    draw (cursor) {
        const { viewbox, fixed } = this;
        const notFixed = !fixed;
        if (notFixed) viewbox.setCursor(cursor, true);
        for (const item of this.#items.values())
            if (this.#supportsDraw(item))
                item.draw(cursor, fixed);
        if (notFixed) cursor.restore();
    }

    #supportsDraw (item) { return typeof item?.draw === "function" }
    #supportsCursorEvents (item) { return typeof item?.isOver === "function" }
    #supportsClickEvents (item) { return typeof item?.onclick === "function" }
    #supportsHoldEvents (item) { return typeof item?.onhold === "function" }
    #supportsDragEvents (item) { return typeof item?.ondrag === "function" }
    #supportsPressEvents (item) { return typeof item?.onpress === "function" }
    #supportsReleaseEvents (item) { return typeof item?.onrelease === "function" }
    #supportsScrollEvents (item) { return typeof item?.onscroll === "function" }

    get isInterfaceLayer () { return true }
    get items () { return [...this.#items.values()].reverse() } // [!] reverse call causes lag / horribly inefficient
    get size () { return this.#items.size }
    get viewbox () { return this.#viewbox }
    set viewbox (viewbox) {
        if (!viewbox?.isViewbox) throw new Error(`[${this.constructor.name}]: Viewbox expected, got ${typeof viewbox}`);
        return (this.#viewbox = viewbox);
    }
}

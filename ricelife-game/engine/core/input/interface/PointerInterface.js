import { TrackableObject } from "../../utils/tracking/TrackableObject.js";
import { typeString } from "../../utils/logging.js";
import { PointerInterfaceLayer } from "./PointerInterfaceLayer.js";

// Manages layers of clickable objects on the canvas
export class PointerInterface extends TrackableObject { // pointer events are prioritized in FIFO order
    #Viewbox;
    #layers = new Array();
    constructor (viewbox = undefined, ...layers) {
        super();
        this.push(...layers);
        this.#Viewbox = viewbox;
    }

    *#iterate (start = 0, end = -1, reverse = true) {
        const stop = (end < 0) ? (end === -1 ? this.length : this.length + (end % this.length)) : end;
        if (reverse) for (let i = stop - 1; i >= start; i--) yield this.layer(i);
        else for (let i = start; i < stop; i++) yield this.layer(i);
    }

    layer (index) { return this.#layers.at(index) }
    insert (index = -1) {
        const layer = new PointerInterfaceLayer(this.Viewbox);
        if (index === -1) this.#layers.push(layer);
        else this.#layers.splice(index, 0, layer);
        return layer; // for chaining
    }
    push (...layers) {
        for (const layer of layers) {
            if (!layer?.isPointerInterfaceLayer) throw new Error(`[${typeString(this)}] Error: Cannot add non-layer object ${typeString(layer)}`);
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
    slice (start = 0, end = -1) { return new PointerInterface(this.Viewbox, ...this.#layers.slice(start, end)) }
    *[Symbol.iterator]() {
        yield *this.#layers;
    }

    get isPointerInterface () { return true }
    get length () { return this.#layers.length }
    get Viewbox () { return this.#Viewbox }
    set Viewbox (viewbox) {
        for (const layer of this.#layers) layer.Viewbox = viewbox;
        return (this.#Viewbox = viewbox);
    }
}

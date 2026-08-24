import { Identifiable } from "../../utils/tracking/Identifiable.js";
import { typeString } from "../../utils/logging.js";

// just a map with some bells + whistles
export class PointerInterfaceLayer extends Identifiable { // pointer events are prioritized in FIFO order
    #Viewbox;
    #items = new Map();
    // when true, coordinates from pointer events and drawing will be interpreted relative to the Viewbox, instead of global space
    // if Viewbox is not defined, fixed is always true.
    #fixed = false; 
    constructor (viewbox = undefined, ...items) {
        super();
        this.push(...items);
        this.#Viewbox = viewbox;
    }

    #isIterable (item) { return typeof item?.[Symbol.iterator] === "function" }
    #supportsDraw (item) { return typeof item?.draw === "function" }
    #supportsCursorEvents (item) { return typeof item?.isOver === "function" }
    #supportsClickEvents (item) { return typeof item?.onclick === "function" }
    #supportsHoldEvents (item) { return typeof item?.onhold === "function" }
    #supportsDragEvents (item) { return typeof item?.ondrag === "function" }
    #supportsPressEvents (item) { return typeof item?.onpress === "function" }
    #supportsReleaseEvents (item) { return typeof item?.onrelease === "function" }
    #supportsScrollEvents (item) { return typeof item?.onscroll === "function" }
    #clicked (item, point, pressed) {
        return (this.#supportsCursorEvents(item)
            && this.#supportsClickEvents(item)
            && item.isOver(point)
            && item.isOver(pressed))
            ? item : undefined;
    }
    #dragged (item, point, origin) {
        return (this.#supportsCursorEvents(item)
            && this.#supportsDragEvents(item)
            && item.isOver(point)
            && item.isOver(origin))
            ? item : undefined;
    }
    #held (item, point) {
        return (this.#supportsCursorEvents(item)
            && this.#supportsHoldEvents(item)
            && item.isOver(point))
            ? item : undefined;
    }
    #pressed (item, point) {
        return (this.#supportsCursorEvents(item)
            && this.#supportsPressEvents(item)
            && item.isOver(point))
            ? item : undefined;
    }
    #released (item, point) {
        return (this.#supportsCursorEvents(item)
            && this.#supportsReleaseEvents(item)
            && item.isOver(point))
            ? item : undefined;
    }
    #scrolled (item, point) {
        return (this.#supportsCursorEvents(item)
            && this.#supportsScrollEvents(item)
            && item.isOver(point))
            ? item : undefined;
    }
    #over (item, point) {
        return (this.#supportsCursorEvents(item)
            && item.isOver(point))
            ? item : undefined;
    }

    // set to relative coordinate if Viewbox cursor is set, otherwise return the same point
    parseCoordinate (point) {
        return this.fixed || !point?.isVector ? point : this.Viewbox.toGlobal(point, false);
    }
    push (...items) {
        for (const item of items) {
            if (!item?.id) throw new Error(`[${typeString(this)}]: Cannot add untrackable object of type ${typeString(item)} to interface layer`);
            if (this.has(item)) throw new Error(`[${typeString(this)}]: Cannot add item to layer - item ${item.id} already exists`);
            this.#items.set(item.id, item);
        }
        return this; // for chaining
    }
    remove (item) {
        return this.#items.delete(item?.id || item);
    }
    clear () {
        this.#items.clear();
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
        const pressed = this.parseCoordinate(point.sub(delta));
        for (const item of this.items) {
            if (this.#isIterable(item)) {
                for (const itm of item) {
                    const result = this.#clicked(itm, pt, pressed);
                    if (result !== undefined) return result;
                }
            } else {
                const result = this.#clicked(item, pt, pressed);
                if (result !== undefined) return result;
            }
        }
        return undefined;
    }
    isDragged (point, origin) {
        const pt = this.parseCoordinate(point);
        const og = this.parseCoordinate(origin);
        for (const item of this.items) {
            if (this.#isIterable(item)) {
                for (const itm of item) {
                    const result = this.#dragged(itm, pt, og);
                    if (result !== undefined) return result;
                }
            } else {
                const result = this.#dragged(item, pt, og);
                if (result !== undefined) return result;
            }
        }
        return undefined;
    }
    isHeld (point) {
        const pt = this.parseCoordinate(point);
        for (const item of this.items) {
            if (this.#isIterable(item)) {
                for (const itm of item) {
                    const result = this.#held(itm, pt);
                    if (result !== undefined) return result;
                }
            } else {
                const result = this.#held(item, pt);
                if (result !== undefined) return result;
            }
        }
        return undefined;
    }
    isPressed (point) {
        const pt = this.parseCoordinate(point);
        for (const item of this.items) {
            if (this.#isIterable(item)) {
                for (const itm of item) {
                    const result = this.#pressed(itm, pt);
                    if (result !== undefined) return result;
                }
            } else {
                const result = this.#pressed(item, pt);
                if (result !== undefined) return result;
            }
        }
        return undefined;
    }
    isReleased (point) {
        const pt = this.parseCoordinate(point);
        for (const item of this.items) {
            if (this.#isIterable(item)) {
                for (const itm of item) {
                    const result = this.#released(itm, pt);
                    if (result !== undefined) return result;
                }
            } else {
                const result = this.#released(item, pt);
                if (result !== undefined) return result;
            }
        }
        return undefined;
    }
    isScrolled (point) {
        const pt = this.parseCoordinate(point);
        for (const item of this.items) {
            if (this.#isIterable(item)) {
                for (const itm of item) {
                    const result = this.#scrolled(itm, pt);
                    if (result !== undefined) return result;
                }
            } else {
                const result = this.#scrolled(item, pt);
                if (result !== undefined) return result;
            }
        }
        return undefined;
    }
    isOver (point) {
        const pt = this.parseCoordinate(point);
        for (const item of this.items) {
            if (this.#isIterable(item)) {
                for (const itm of item) {
                    const result = this.#over(itm, pt);
                    if (result !== undefined) return result;
                }
            } else {
                const result = this.#over(item, pt);
                if (result !== undefined) return result;
            }
        }
        return undefined;
    }
    draw (cursor) {
        const { Viewbox, fixed } = this;
        const notFixed = !fixed;
        if (notFixed) Viewbox.setCursor(cursor, true);
        for (const item of this.#items.values())
            if (this.#supportsDraw(item) && !item?.hide)
                item.draw(cursor, fixed);
        if (notFixed) cursor.restore();
    }

    get isPointerInterfaceLayer () { return true }
    get items () { return [...this.#items.values()].reverse() } // [!] reverse call causes lag / horribly inefficient
    get size () { return this.#items.size }
    get fixed () { return this.#fixed || !this.#isViewboxSet }
    set fixed (bool) { return (this.#fixed = bool) || !this.#isViewboxSet }
    get Viewbox () { return this.#Viewbox }
    set Viewbox (viewbox) { return (this.#Viewbox = viewbox) }
    get #isViewboxSet () { return this.#Viewbox?.isViewbox }
}

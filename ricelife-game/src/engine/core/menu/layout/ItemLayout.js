import { BoundingBox } from "../../geometry/BoundingBox.js";
import { Vector } from "../../math/Vector.js";
import { MenuItem } from "../MenuItem.js";
import { LayoutSpacing } from "./LayoutSpacing.js";

export class ItemLayout extends MenuItem {
    #items = new Array();
    #padding = new LayoutSpacing();
    #margin = new LayoutSpacing();
    #position = new Vector();
    isColumn = false;
    constructor () {
        super();
        this.padding.onupdate = () => this.updateLayout();
        this.margin.onupdate = () => this.updateLayout();
    }

    #getCallback (key) {
        const items = this.#items;
        for (let i = 0; i < items.length; i++) {
            const item = items[i]?.[key];
            if (item) return item;
        }
        return null;
    }
    #updateColumnPositions () {

    }
    #updateRowPositions () {

    }

    // menuitem methods
    draw (cursor, fixed) {
        const items = this.#items;
        for (let i = 0; i < items.length; i++)
            items[i]?.draw?.(cursor, fixed);
    }
    isOver (point) {
        const items = this.#items;
        for (let i = 0; i < items.length; i++)
            if (items[i]?.isOver?.(point))
                return true;
        return false;
    }
    updateLayout () {
        if (this.isColumn)
            this.#updateColumnPositions();
        else
            this.#updateRowPositions();
    }

    setPosition (x, y = null) {
        this.#position.apply(x, y);
        this.updateLayout();
    }
    getPosition () { return this.#position.clone() }
    getBoundingBox () { return BoundingBox.merge(this.#items.map((item) => item.getBoundingBox())) }
    // array-like methods
    get (id) {
        const items = this.#items;
        for (let i = 0; i < items.length; i++)
            if (items[i]?.id === id)
                return items[i];
        return null;
    }
    at (index) {
        return this.#items.at(index);
    }
    unshift (...items) {
        const length = this.#items.unshift(...items);
        this.updateLayout();
        return length;
    }
    shift () {
        const item = this.#items.shift();
        this.updateLayout();
        return item;
    }
    push (...items) {
        const length = this.#items.push(...items);
        this.updateLayout();
        return length;
    }
    pop () {
        const item = this.#items.pop();
        this.updateLayout();
        return item;
    }
    splice (...args) {
        const items = this.#items.splice(...args);
        this.updateLayout();
        return items;
    }
    filter (...args) { return this.#items.filter(...args) }
    map (...args) { return this.#items.map(...args) }
    *[Symbol.iterator] () {
        yield this.#items;
    }

    get isItemContainer () { return true }
    get length () { return this.#items.length }
    get padding () { return this.#padding }
    get margin () { return this.#margin }
    get onclick () { return this.hide ? null : this.#getCallback("onclick") }
    get onhold () { return this.hide ? null : this.#getCallback("onhold") }
    get ondrag () { return this.hide ? null : this.#getCallback("ondrag") }
    get onpress () { return this.hide ? null : this.#getCallback("onpress") }
    get onrelease () { return this.hide ? null : this.#getCallback("onrelease") }
    get onscroll () { return this.hide ? null : this.#getCallback("onscroll") }
}

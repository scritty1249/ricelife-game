import { Color } from "../math/Color.js";
import { equals } from "../math/utils.js";
import { PhysicsObject } from "./PhysicsObject.js";

export class Projectile extends PhysicsObject {
    // configuration
    static tailLength = 10;
    static tailColor = new Color(255, 255, 255, .55);
    static glowRadius = 20;
    static glowResolution = 10;
    static glowColor = new Color(255, 0, 0, .4);
    static mainColor = new Color(255, 255, 255);
    // instance
    tailLength;
    tailColor;
    glowRadius;
    glowResolution;
    glowColor;
    mainColor;
    // other instance variables
    #shape;
    #tail = new Array();
    constructor (origin, velocity, acceleration, drag, shape) {
        super(origin, velocity, acceleration, drag);
        // config overrides
        this.tailLength = new.target.tailLength || Shot.tailLength;
        this.tailColor = (new.target.tailColor || Shot.tailColor).clone();
        this.glowRadius = new.target.glowRadius || Shot.glowRadius;
        this.glowResolution = new.target.glowResolution || Shot.glowResolution;
        this.glowColor = (new.target.glowColor || Shot.glowColor).clone();
        this.mainColor = (new.target.mainColor || Shot.mainColor).clone();
        this.#shape = shape;
    }

    #drawGlow (cursor, shape) {
        cursor.save();
        cursor.filter = `blur(${this.glowResolution}px)`;
        shape.draw(cursor);
        cursor.strokeStyle = this.glowColor.toString();
        cursor.lineWidth = this.glowRadius;
        cursor.stroke();
        // mask out projectile space itself
        cursor.globalCompositeOperation = "destination-out";
        cursor.fill();
        cursor.globalCompositeOperation = "source-over";
        cursor.restore();
    }
    // call just before updating position
    #updateTail () {
        // reset scaling
        const minScale = 1 / (this.tail.length || this.constructor.tailLength);
        for (let i = 0; i < this.tail.length; i++) {
            const tail = this.tail[i];
            const scale = minScale + (i / this.tail.length);
            tail.transform.save();
            tail.transform.reset();
            tail.transform.scale.apply(equals(scale, 0) ? 0 : 1 / scale);
            tail.applyTransform();
            tail.transform.restore();
        }
        this.tail.push(this.shape.clone(true));
        if (this.tail.length >= this.tailLength) this.tail.shift();
        // apply new scaling
        for (let i = 0; i < this.tail.length; i++) {
            const tail = this.tail[i];
            const scale = minScale + (i / this.tail.length);
            tail.transform.save();
            tail.transform.reset();
            tail.transform.scale.apply(scale);
            tail.applyTransform();
            tail.transform.restore();
        }
    }

    draw (cursor) {
        this.drawTailGlow(cursor);
        this.drawMainGlow(cursor);
        this.drawTail(cursor);
        this.drawShot(cursor);
    }
    drawShot (cursor) {
        cursor.save();
        cursor.fillStyle = this.mainColor.toString();
        this.shape.draw(cursor);
        cursor.fill();
        cursor.restore();
    }
    drawTail (cursor) {
        cursor.save();
        cursor.fillStyle = this.tailColor.toString();
        for (const tail of this.tail) {
            tail.draw(cursor, true);
            cursor.fill();
        }
        cursor.restore();
    }
    drawMainGlow (cursor) {
        this.#drawGlow(cursor, this.shape);
    }
    drawTailGlow (cursor) {
        cursor.save();
        cursor.fillStyle = this.tailColor.toString();
        for (const tail of this.tail) {
            this.#drawGlow(cursor, tail);
            cursor.fill();
        }
        cursor.restore();
    }
    applyPosition (vector, updateTail = false) {
        if (updateTail) this.#updateTail();
        this.shape.moveTo(vector);
        this.position.apply(vector);
    }
    update (seconds = 1) {
        this.#updateTail();
        this.shape.moveTo(super.update(seconds));
        return this.position; // for chaining
    }
    project (seconds = 1) {
        const projection = super.project(seconds);
        const shape = this.shape.clone(true);
        shape.moveTo(projection.position);
        projection.shape = shape;
        projection.traversalArea = this.shape.getBoundingBox().add(shape.getBoundingBox());
        return projection;
    }
    collision (polygons = []) {
        const intersecting = [];
        const intersections = [];
        const shape = this.shape;
        for (const polygon of polygons)
            if (shape.isIntersecting(polygon)) intersecting.push(polygon);
        if (intersecting.length > 0) {
            const poly = shape.Polygon(1);
            for (const polygon of intersecting) {
                const overlap = poly.overlap(polygon, true);
                intersections.push({
                    polygon,
                    overlap,
                    normal: overlap.length >= 2 ? overlap.normal() : undefined
                });
            }
        } else return undefined; // signal nothing is intersecting
        return intersections;
    }
    // get bounding box of shape, optionally include bounding box of visual effects (ex: glow, tail)
    // [!] returns a clone if includeFx = true
    getBoundingBox (includeFx = false) {
        const { shape } =  this;
        if (!includeFx) return shape.getBoundingBox();
        const bbox = shape.getBoundingBox().clone();
        const glowSize = this.glowRadius + this.glowResolution;
        bbox.min.sub(glowSize, true);
        bbox.max.add(glowSize, true);
        for (const tail of this.tail) {
            const bb = tail.getBoundingBox().clone();
            bb.min.sub(glowSize, true);
            bb.max.add(glowSize, true);
            bbox.add(bb, true);
        }
        return bbox;
    }
    clone (deep = false) { 
        const shot = new Projectile(this.origin.position, this.origin.velocity, this.acceleration, this.drag, this.shape.clone(deep));
        // copy configs
        shot.tailLength = this.tailLength;
        shot.tailColor = this.tailColor.clone();
        shot.glowRadius = this.glowRadius;
        shot.glowResolution = this.glowResolution;
        shot.glowColor = this.glowColor.clone();
        shot.mainColor = this.mainColor.clone();
        return shot;
    }

    get isProjectile () { return true }
    get shape () { return this.#shape }
    get tail () { return this.#tail }
}

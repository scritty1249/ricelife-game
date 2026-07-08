import { TrackableObject, floatEqual } from "../utils/utils.js";
import { Vector, Color, Path } from "../geometry/geometry.js";

export class Projectile extends TrackableObject {
    #tracer = new Path();
    #time = 0; // in seconds
    #origin = {
        position: new Vector(),
        velocity: new Vector()
    };
    #current = {
        position: new Vector(),
        velocity: new Vector()
    };
    constructor (origin, velocity, acceleration, drag) {
        super();
        this.drag = drag; // coefficient, values >1 will make projectiles move backwards infinitely
        this.acceleration = new Vector(acceleration);

        this.origin.position.apply(origin);
        this.origin.velocity.apply(velocity);
        this.current.position.apply(origin);
        this.current.velocity.apply(velocity);
    }

    updatePosition (seconds) {
        const { position, velocity } = this;
        const acceleration = this.acceleration.clone();
        const v = velocity.mul(-this.drag * Math.sqrt(velocity.pow(2).sum()));
        if (velocity.x < 0)
            acceleration.x *= -1;
        else if (floatEqual(velocity.x, 0)) 
            acceleration.x *= 0;
        position.add(velocity.mul(seconds), true);
        velocity.add(acceleration.add(v).mul(seconds, true), true);
    }
    projectPosition (seconds) {
        const { position, velocity } = this;
        const acceleration = this.acceleration.clone();
        const v = velocity.mul(-this.drag * Math.sqrt(velocity.pow(2).sum()));
        if (velocity.x < 0)
            acceleration.x *= -1;
        else if (floatEqual(velocity.x, 0)) 
            acceleration.x *= 0;
        return {
            position: position.add(velocity.mul(seconds)),
            velocity: velocity.add(acceleration.add(v).mul(seconds, true))
        };
    }
    update (seconds = 1) {
        this.tracer.push(this.position.clone());
        if (!this.isStopped) this.updatePosition(seconds);
        this.#time += seconds;
        return this.position;
    }
    // simulate update
    project (seconds = 1) {
        if (this.isStopped) {
            return {
                position: this.position.clone(),
                velocity: this.velocity.clone(),
                time: this.time + seconds
            };
        } else {
            const projection = this.projectPosition(seconds);
            projection.time = this.time + seconds;
            return projection;
        }
    }
    reset () {
        this.current.position.apply(this.origin);
        this.current.velocity.apply(this.velocity);
        this.#time = 0;
    }

    get isProjectile () { return true }
    get speed () { return this.velocity.length }
    get position () { return this.current.position }
    get velocity () { return this.current.velocity }
    get direction () { return this.velocity.normalize() }
    get tracer () { return this.#tracer }
    get time () { return this.#time }
    get origin () { return this.#origin }
    get current () { return this.#current }
    get isStopped () { return floatEqual(this.speed, 0) }
    clone () { return new Projectile(this.origin.position, this.origin.velocity, this.acceleration, this.drag) }
}

// projectile with a shape / hitbox
export class Shot extends Projectile {
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
        const minScale = 1 / this.tail.length;
        for (let i = 0; i < this.tail.length; i++) {
            const tail = this.tail[i];
            const scale = minScale + (i / this.tail.length);
            tail.transformation.save();
            tail.transformation.reset();
            tail.transformation.scale.apply(scale === 0 ? 0 : 1 / scale);
            tail.applyTransformation();
            tail.transformation.restore();
        }
        this.tail.push(this.shape.clone(true));
        if (this.tail.length >= this.tailLength) this.tail.shift();
        // apply new scaling
        for (let i = 0; i < this.tail.length; i++) {
            const tail = this.tail[i];
            const scale = minScale + (i / this.tail.length);
            tail.transformation.save();
            tail.transformation.reset();
            tail.transformation.scale.apply(scale);
            tail.applyTransformation();
            tail.transformation.restore();
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
            bbox.merge(bb, true);
        }
        return bbox;
    }
    clone (deep = false) { 
        const shot = new Shot(this.origin.position, this.origin.velocity, this.acceleration, this.drag, this.shape.clone(deep));
        // copy configs
        shot.tailLength = this.tailLength;
        shot.tailColor = this.tailColor.clone();
        shot.glowRadius = this.glowRadius;
        shot.glowResolution = this.glowResolution;
        shot.glowColor = this.glowColor.clone();
        shot.mainColor = this.mainColor.clone();
        return shot;
    }

    get isShot () { return true }
    get shape () { return this.#shape }
    get tail () { return this.#tail }
}

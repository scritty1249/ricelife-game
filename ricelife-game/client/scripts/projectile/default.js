import { TrackableObject, floatEqual } from "../utils/utils.js";
import { Circle, Vector, Direction, Color, Path, Ray } from "../geometry/geometry.js";

export class Projectile extends TrackableObject {
    #tracer;
    #time = 0; // in seconds
    constructor (origin, velocity, acceleration, drag) {
        super();
        this.origin = origin.clone();
        this.drag = drag; // coefficient, values >1 will make projectiles move backwards infinitely
        this.acceleration = new Vector(acceleration);
        this.velocity = new Vector(velocity);
        this.current = {
            position: new Vector(origin),
            velocity: this.velocity.clone()
        };
        {
            const tracer = new Path();
            const _originalDraw = tracer.draw;
            tracer.draw = function (cursor) {
                cursor.save();
                cursor.setLineDash([10, 20]);
                cursor.strokeStyle = "rgba(255, 255, 255, .35)";
                _originalDraw.call(this, cursor);
                cursor.restore();
            }
            this.#tracer = tracer;
        }
    }

    get speed () {
        return Math.sqrt(this.current.velocity.pow(2).sum());
    }

    get position () {
        return this.current.position;
    }
    get isProjectile () {
        return true
    }

    updatePosition (seconds) {
        const position = this.current.position;
        const velocity = this.current.velocity;
        const acceleration = this.acceleration.clone();
        const v = velocity.mul(-this.drag * Math.sqrt(velocity.pow(2).sum()));
        if (velocity.x < 0)
            acceleration.x *= -1;
        else if (floatEqual(velocity.x, 0)) 
            acceleration.x *= 0;
        position.add(velocity.mul(seconds), true);
        velocity.add(acceleration.add(v).mul(seconds), true);
    }

    update (seconds = 1) {
        this.#tracer.push(this.current.position.clone());
        if (!this.isStopped) this.updatePosition(seconds);
        this.#time += seconds;
        return this.current.position;
    }

    reset () {
        this.current.position.apply(this.origin);
        this.current.velocity.apply(this.velocity);
        this.#time = 0;
    }

    get isProjectile () { return true }
    get tracer () { return this.#tracer }
    get time () { return this.#time }
    get isStopped () { return floatEqual(this.current.velocity.x, 0) && floatEqual(this.current.velocity.y, 0) }
    clone () { return new Projectile(this.origin, this.velocity, this.acceleration, this.drag) }
}

export class Shot extends Projectile {
    // configuration
    static tailLength = 10;
    static tailColor = new Color(255, 255, 255, 160);
    static glowRadius = 25;
    static glowResolution = 5;
    static glowColor = new Color(255, 0, 0, 100);
    static mainColor = new Color(255, 255, 255);
    static collisionBehavior (intersections = []) { // expects each intersection to be: {polygon, overlap: [...Path]}
        this.current.velocity.mul(0, true);
    }
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
        this.collisionBehavior = (new.target.collisionBehavior || Shot.collisionBehavior).bind(this);

        this.#shape = shape;
    }

    #drawGlow (cursor, shape) {
        cursor.save();
        shape.draw(cursor);
        for (let i = 0; i <= this.glowRadius; i += this.glowResolution) {
            const color = this.glowColor.clone();
            color.a *= (1 - (i / this.glowRadius)).toFixed(2);
            cursor.strokeStyle = color.toString();
            cursor.lineWidth = i;
            cursor.stroke();
        }
        // mask out projectile space itself
        cursor.globalCompositeOperation = "destination-out";
        cursor.fill();
        cursor.globalCompositeOperation = "source-over";
        cursor.restore();
    }
    // expensive but accurate. we should only be calling this ONCE when a shot is fired anyways
    // returns the projectiles position when it's shape intersects with the given terrain
    intersectAt (polygons, increment = 1/60, limit = 60) {
        if (polygons.some(({isPolygon}) => !isPolygon)) throw new Error(`[${this.constructor.name}] Error: Cannot perform intersection operation with non-Polygon`);
        const proj = this.clone(true);
        const result = {
            state: proj, // [!] this is deleted before being passed back through web worker- children should intercept and record important state values before passing back to main thread
            point: undefined,
            at: undefined
        };
        while (result.at === undefined && proj.time < limit) {
            proj.update(increment, polygons);
            if (proj.isStopped) {
                result.point = proj.position.clone();
                result.at = proj.time;
            }
        }
        return result;
    }
    draw (cursor) {
        this.drawGlow(cursor);
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
        const minScale = 1 / this.tail.length;
        const scales = [];
        for (let i = 0; i < this.tail.length; i++) {
            const tail = this.tail[i];
            scales.push(tail.scale.clone());
            tail.scale.apply(minScale + (i / this.tail.length));
            this.#drawGlow(cursor, tail);
        }
        for (let i = 0; i < this.tail.length; i++) {
            const tail = this.tail[i];
            tail.draw(cursor);
            tail.scale.apply(scales[i]);
            cursor.fill();
        }
        cursor.restore();
    }
    drawGlow (cursor) {
        this.#drawGlow(cursor, this.shape);
    }
    update (seconds = 1, collisions = []) {
        if (!this.isStopped) {
            const intersecting = [];
            const shape = this.shape;
            const position = this.position.clone();
            for (const polygon of collisions)
                if (polygon.isIntersecting(shape)) intersecting.push(polygon);
            if (intersecting.length > 0) {
                const intersections = [];
                for (const polygon of intersecting)
                    intersections.push({polygon, overlap: polygon.overlap(shape)});
                if (intersections.length) {
                    this.collisionBehavior(intersections);
                } else {
                    console.warn(`[${this.constructor.name}]: Failed to find intersection for collision. Collision behavior ignored`);
                    this.current.velocity.mul(0, true);
                }
            }
        }
        if (this.tail.length >= this.tailLength) this.tail.shift();
        this.tail.push(this.shape.clone());
        this.shape.position.apply(super.update(seconds));
    }
    clone (deep = false) { return new Shot(this.origin, this.velocity, this.acceleration, this.drag, this.shape.clone(deep)) }

    get shape () { return this.#shape }
    get tail () { return this.#tail }
}

// [!] can be passed safely between web workers
export class Blast { // only intended to record information, properties should be extracted before manipulating data
    #shape;
    #delay; // MILLISECONDS
    constructor (shape, delay = 0) {
        if (!shape?.isCircle) throw new Error(`[${this.constructor.name}]: Invalid argument - Circle expected, got ${typeof shape}`);
        if (delay < 0) throw new Error(`[${this.constructor.name}]: Invalid argument - delay must be a non-negative numeric value, got ${delay}`);
        this.#shape = shape;
        this.#delay = delay;
    }

    toJSON () {
        return {
            shape: this.shape,
            delay: this.delay,
            position: this.position,
            radius: this.radius
        }
    }
    decode () {
        return {
            delay: this.delay,
            position: this.shape.position.toJSON(),
            radius: this.shape.radius,
            resolution: this.shape.resolution
        }
    }
    clone (deep = false) {
        return new Blast(this.shape.clone(deep), this.delay);
    }

    get isBlast () { return true }
    get shape () { return this.#shape }
    get radius () { return this.#shape.radius }
    set radius (value) { return (this.#shape.radius = value) }
    get delay () { return this.#delay }
    set delay (value) {
        if (value < 0) throw new Error(`[${this.constructor.name}]: Invalid value - delay must be a non-negative numeric value, got ${value}`);
        return (this.#delay = value);
    }
    get position () { return this.#shape.position }

    static fromObject (payload) {
        const shape = new Circle(Vector.fromObject(payload.position), payload.radius, payload.resolution);
        const blast = new Blast(shape, payload.delay);
        return blast;
    }
}

export class BasicShot extends Shot {
    // config
    static collisionBehavior (intersections = []) {
        this.current.velocity.mul(0, true);
        this.applyBlast();
    }
    static acceleration = new Vector(20, -200);
    static initalSpeed = 400;
    static drag = 0.001;
    static radius = 7;
    // instance
    acceleration;
    initalSpeed;
    drag;
    radius;
    // other instance variables
    #blasts = new Array();
    #hitbox = new Array();
    constructor (origin, angle, power = 1, resolution = 1) {
        const acceleration = (new.target.acceleration || BasicShot.acceleration).clone();
        const initalSpeed = new.target.initalSpeed || BasicShot.initalSpeed;
        const drag = new.target.drag || BasicShot.drag;
        const radius = new.target.radius || BasicShot.radius;

        const direction = Direction(angle, false).mul(initalSpeed * power);
        super(origin, direction, acceleration, drag, new Circle(origin, radius, resolution));
        // make accessible for later calculations
        this.direction = direction;
        this.angle = angle;
        this.power = power;
        // config overrrides
        this.acceleration = acceleration;
        this.initalSpeed = initalSpeed;
        this.drag = drag;
        this.radius = radius;
        this.#hitbox.push(new Blast(new Circle(new Vector(), 30, resolution), 0));

        const currentPosition = this.current.position;
    }

    intersectAt (polygons, increment = 1/60, limit = 60, float64 = false) {
        const result = super.intersectAt(polygons, increment, limit);
        // storing data to be passed from web workers
        const blasts = [...result.state.blasts]; // dereference
        if (float64) {
            result.blasts = blasts.map((blast) => blast.decode());
        } else {
            result.blasts = blasts;
        }
        return result;
    }
    reset () {
        super.reset();
        // dereference old values, don't wipe them
        this.#blasts = new Array();
    }
    applyBlast () {
        const blasts = this.blasts;
        const position = this.position;
        const time = this.time * 1000;
        for (const blast of this.hitbox) {
            const b = blast.clone(true);
            b.position.add(position, true);
            b.delay += time;
            blasts.push(b);
        }
    }
    clone () { return new BasicShot(this.origin, this.angle, this.power, this.resolution) }

    get hitbox () { return this.#hitbox }
    get blasts () { return this.#blasts }
}

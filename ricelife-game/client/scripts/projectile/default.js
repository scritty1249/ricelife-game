import { TrackableObject, floatEqual } from "../utils/utils.js";
import { Circle, Vector, Direction, Color, Path, Ray } from "../geometry/geometry.js";

export class Projectile extends TrackableObject {
    #tracer;
    #time = 0;
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
        this.updatePosition(seconds);
        this.#time += seconds;
        return this.current.position;
    }

    reset () {
        this.current.position.apply(this.origin);
        this.current.velocity.apply(this.velocity);
        this.#time = 0;
    }

    // [!] broken
    // positionAt (seconds, resolution = 0.01) {
    //     const position = this.origin.clone();
    //     if (seconds <= 0) return position;
    //     const velocity = this.velocity.clone();
    //     const acceleration = this.acceleration.clone();
    //     let t = 0;
    //     while (t < seconds) {
    //         const dt = Math.min(resolution, seconds - t);            
    //         const v = velocity.mul(-this.drag * Math.sqrt(velocity.pow(2).sum()));
    //         const acc = acceleration.clone();
    //         if (v.x < 0)
    //             acc.x *= -1;
    //         else if (floatEqual(v.x, 0))
    //             acc.x *= 0;
    //         velocity.add(acc.add(v).mul(dt), true);
    //         position.add(velocity.mul(dt), true);
    //         t += dt;
    //     }
    //     return position;
    // }

    get isProjectile () { return true }
    get tracer () { return this.#tracer }
    get time () { return this.#time }
    *tracerAt () { }
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
    static collisionBehavior = function (point, angle, polygon) {
        this.velocity.mul(0, true);
        return true;
    }
    // instance
    tailLength;
    tailColor;
    glowRadius;
    glowResolution;
    glowColor;
    mainColor;
    collisionBehavior;
    // other instance variables
    #lastPosition = new Vector(); // used for drawing raycaster when finding collision angles
    #shape;
    #colliding = false;
    #tail = new Array();
    constructor (origin, velocity, acceleration, drag, shape) {
        super(origin, velocity, acceleration, drag);
        // config overrides
        this.tailLength = new.target.tailLength || Shot.tailLength;
        this.tailColor = new.target.tailColor || Shot.tailColor;
        this.glowRadius = new.target.glowRadius || Shot.glowRadius;
        this.glowResolution = new.target.glowResolution || Shot.glowResolution;
        this.glowColor = new.target.glowColor || Shot.glowColor;
        this.mainColor = new.target.mainColor || Shot.mainColor;
        this.collisionBehavior = (new.target.collisionBehavior || Shot.collisionBehavior).bind(this);

        this.#lastPosition.apply(this.current.position);
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
    intersectAt (polygons, increment = 1/60, limit = 1000) {
        if (polygons.some(({isPolygon}) => !isPolygon)) throw new Error(`[${this.constructor.name}] Error: Cannot perform intersection operation with non-Polygon`);
        const proj = this.clone(true);
        for (let t = 0; t < limit; t += increment) {
            proj.update(increment, polygons);
            if (proj.isColliding) return { point: proj.position.clone(), at: t };
        }
        return undefined;
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
        if (!this.isColliding) {
            let intersecting;
            const shape = this.shape;
            for (const polygon of collisions) {
                if (shape.isIntersecting(polygon)) {
                    intersecting = polygon;
                    break;
                }
            }
            if (intersecting?.isPolygon) {
                const position = this.current.position;
                const direction = Direction(this.#lastPosition.angle(position), false);
                const distance = this.#lastPosition.distance(position);
                const ray = Ray(this.#lastPosition, direction, distance * 2);
                const hits = intersecting.raycast(ray)
                    ?.filter?.(({entering}) => entering)
                    ?.sort?.((a, b) => position.distance(a.point) - position.distance(b.point));
                if (hits.length) {
                    const { point, angle } = hits?.at?.(0);
                    this.#colliding = this.collisionBehavior(point, angle, intersecting);
                } else {
                    console.warn(`[${this.constructor.name}]: Failed to find intersection for collision. Collision behavior ignored`);
                    this.#colliding = true;
                }
            }
            this.#lastPosition.apply(this.current.position);
        }
        if (this.tail.length >= this.tailLength) this.tail.shift();
        this.tail.push(this.shape.clone());
        if (!this.isColliding) this.shape.position.apply(super.update(seconds));
    }
    clone (deep = false) { return new Shot(this.origin, this.velocity, this.acceleration, this.drag, this.shape.clone(deep)) }

    get isColliding () { return this.#colliding }
    get shape () { return this.#shape }
    get tail () { return this.#tail }
}

export class BasicShot extends Shot {
    // config
    static acceleration = new Vector(20, -200);
    static initalSpeed = 400;
    static drag = 0.001;
    static radius = 7;
    static blastRadius = 30;
    // instance
    acceleration;
    initalSpeed;
    drag;
    radius;
    blastRadius;
    // other instance variables
    #blast;
    config;
    constructor (origin, angle, power = 1, resolution = 1) {
        const acceleration = (new.target.acceleration || BasicShot.acceleration).clone();
        const initalSpeed = new.target.initalSpeed || BasicShot.initalSpeed;
        const drag = new.target.drag || BasicShot.drag;
        const radius = new.target.radius || BasicShot.radius;
        const blastRadius = new.target.blastRadius || BasicShot.blastRadius;

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
        this.blastRadius = blastRadius;

        const currentPosition = this.current.position;
        this.#blast = {
            blasts: [{
                shape: new Circle(new Vector(), this.blastRadius, resolution),
                delay: 0 // milliseconds
            }],
            push: function (shape, delayMs) { this.blasts.push({ shape, delay: delayMs }) },
            blastsAt: function (position) {
                return Array.from(this.blasts, ({shape, delay}) => {
                    const newBlast = {
                        delay,
                        shape: shape.clone(),
                    }
                    newBlast.shape.position.add(position, true);
                    return newBlast;
                }).sort((a, b) => a.delay - b.delay);
            }
        };
    }

    get blast () { return this.#blast }
}

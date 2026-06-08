import { TrackableObject, floatEqual } from "../utils/utils.js";
import { Circle, Vector, Direction, Color, Path } from "../geometry/geometry.js";

export class Projectile extends TrackableObject {
    #tracer;
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

    update (seconds = 1) {
        const position = this.current.position;
        const velocity = this.current.velocity;
        const acceleration = this.acceleration.clone();
        const v = velocity.mul(-this.drag * Math.sqrt(velocity.pow(2).sum()));
        if (velocity.x < 0)
            acceleration.x *= -1;
        else if (floatEqual(velocity.x, 0))
            acceleration.x *= 0;
        this.#tracer.push(position.clone());
        position.add(velocity.mul(seconds), true);
        velocity.add(acceleration.add(v).mul(seconds), true);
        return position;
    }

    reset () {
        this.current.position.apply(this.origin);
        this.current.velocity.apply(this.velocity);
    }

    // [!] broken
    positionAt (seconds, resolution = 0.01) {
        const position = this.origin.clone();
        if (seconds <= 0) return position;
        const velocity = this.velocity.clone();
        const acceleration = this.acceleration.clone();
        let t = 0;
        while (t < seconds) {
            const dt = Math.min(resolution, seconds - t);            
            const v = velocity.mul(-this.drag * Math.sqrt(velocity.pow(2).sum()));
            const acc = acceleration.clone();
            if (v.x < 0)
                acc.x *= -1;
            else if (floatEqual(v.x, 0))
                acc.x *= 0;
            velocity.add(acc.add(v).mul(dt), true);
            position.add(velocity.mul(dt), true);
            t += dt;
        }
        return position;
    }

    get tracer () { return this.#tracer }
    *tracerAt () { }
    clone () { return new Projectile(this.origin, this.velocity, this.acceleration, this.drag) }
}

export class BasicShot extends Projectile {
    #shape;
    #blast;
    #tail = new Array();
    config;
    constructor (origin, angle, power = 1, resolution = 1) {
        const defualtConfig = {
            initalSpeed: 400,
            acceleration: new Vector(20, -200),
            drag: 0.001,
            radius: 7,
            blastRadius: 30,
            color: {
                main: new Color(255, 255, 255),
                tail: new Color(255, 255, 255, 160),
                glow: new Color(255, 0, 0, 100)
            },
            glow: {
                radius: 25,
                resolution: 5
            },
            tail: {
                length: 10
            }
        };
        const config = new.target.config
            ? {...defualtConfig, ...new.target.config}
            : defualtConfig;
        const direction = Direction(angle, false).mul(config.initalSpeed * power);
        super(origin, direction, config.acceleration, config.drag);
        this.direction = direction; // make accessible for later calculations
        this.config = config;
        const currentPosition = this.current.position;
        this.#shape = new Circle(currentPosition, config.radius, resolution);
        this.#blast = {
            blasts: [{
                shape: new Circle(new Vector(), config.blastRadius, resolution),
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

    update (seconds = 1) {
        if (this.#tail.length >= this.config.tail.length) this.#tail.shift();
        this.#tail.push(this.shape.clone());
        this.#shape.position.apply(super.update(seconds));
    }

    draw (cursor) {
        this.drawGlow(cursor);
        this.drawTail(cursor);
        this.drawShot(cursor);
    }

    drawShot (cursor) {
        cursor.save();
        cursor.fillStyle = this.config.color.main.toString();
        this.shape.draw(cursor);
        cursor.fill();
        cursor.restore();
    }

    drawTail (cursor) {
        cursor.save();
        cursor.fillStyle = this.config.color.tail.toString();
        const minScale = 1 / this.#tail.length;
        const scales = [];
        for (let i = 0; i < this.#tail.length; i++) {
            const tail = this.#tail[i];
            scales.push(tail.scale.clone());
            tail.scale.apply(minScale + (i / this.#tail.length));
            this.#drawGlow(cursor, tail);
        }
        for (let i = 0; i < this.#tail.length; i++) {
            const tail = this.#tail[i];
            tail.draw(cursor);
            tail.scale.apply(scales[i]);
            cursor.fill();
        }
        cursor.restore();
    }

    drawGlow (cursor) {
        this.#drawGlow(cursor, this.shape);
    }

    #drawGlow (cursor, shape) {
        cursor.save();
        shape.draw(cursor);
        for (let i = 0; i <= this.config.glow.radius; i += this.config.glow.resolution) {
            const color = this.config.color.glow.clone();
            color.a *= (1 - (i / this.config.glow.radius)).toFixed(2);
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
    intersectAt (polygon, increment = 1/60, limit = 1000) {
        if (!polygon.isPolygon) throw new Error(`[${this.constructor.name}] Error: Cannot perform intersection operation with non-Polygon`);
        const hitbox = this.shape.clone();
        const proj = this.clone();
        for (let t = 0; t < limit; t += increment) {
            hitbox.position.apply(proj.position);
            if (polygon.isIntersecting(hitbox)) return { point: proj.position.clone(), at: t };
            proj.update(increment);
        }
        return undefined;
    }

    get shape () { return this.#shape }
    get blast () { return this.#blast }
}

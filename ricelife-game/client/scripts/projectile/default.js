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
    config;
    constructor (origin, angle, power = 1, resolution = 1) {
        const config = new.target.config
            ? new.target.config
            : {
                initalSpeed: 400,
                acceleration: new Vector(20, -200),
                drag: 0.001,
                radius: 5,
                blastRadius: 30
            };
        const direction = Direction(angle).mul(config.initalSpeed * power);
        super(origin, direction, config.acceleration, config.drag);
        this.direction = direction; // make accessible for later calculations
        this.config = config;
        const currentPosition = this.current.position;
        this.#shape = new Circle(currentPosition, config.radius, resolution);
        this.#blast = {
            color: new Color("#FFD300"),
            _shapes: [new Circle(new Vector(), config.blastRadius, resolution)],
            get shapes () {
                return this.shapesAt(currentPosition);
            },
            shapesAt: function (position) {
                return Array.from(this._shapes, (shape) => shape.translate(position));
            },
            draw: function (cursor) {
                for (const shape of this.shapes) {
                    cursor.save();
                    cursor.fillStyle = this.color;
                    shape.draw(cursor);
                    cursor.fill();
                    cursor.restore();
                }
            }
        };
        this.color = new Color("#FF0000");
    }

    update (seconds = 1) {
        super.update(seconds);
        this.#shape.updatePath();
    }

    draw (cursor) {
        cursor.fillStyle = this.color;
        this.shape.draw(cursor);
        cursor.fill();
    }

    // expensive but accurate. we should only be calling this ONCE when a shot is fired anyways
    // returns the projectiles position when it's shape intersects with the given terrain
    intersectAt (polygon, increment = 1/60, limit = 1000) {
        if (!polygon.isPolygon) throw new Error("[BasicShot] Error: Cannot perform intersection operation with non-Polygon");
        const hitbox = this.shape.clone();
        const proj = this.clone();
        hitbox._position = proj.position;
        for (let t = 0; t < limit; t += increment) {
            hitbox.updatePath();
            if (polygon.isIntersecting(hitbox)) return { point: proj.position.clone(), at: t };
            proj.update(increment);
        }
        return undefined;
    }

    get shape () { return this.#shape }
    get blast () { return this.#blast }
}

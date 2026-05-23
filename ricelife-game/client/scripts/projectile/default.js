import { TrackableObject } from "../utils.js";
import { Circle, Vector, Direction, Color } from "../geometry/geometry.js";

export class Projectile extends TrackableObject {
    constructor (origin, velocity, acceleration, drag) {
        super();
        this.origin = origin; // allow for references to be passed
        this.drag = drag; // coefficient, values >1 will make projectiles move backwards infinitely
        this.acceleration = new Vector(acceleration);
        this.velocity = new Vector(velocity);
        this.current = {
            position: new Vector(origin),
            velocity: this.velocity.clone()
        };
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
        const acceleration = this.acceleration;

        const v = velocity.mul(-this.drag * Math.sqrt(velocity.pow(2).sum()));
        velocity.add(this.acceleration.add(v).mul(seconds), true);
        position.add(velocity.mul(seconds), true);

        return position;
    }

    reset () {
        this.current.position.apply(this.origin);
        this.current.velocity.apply(this.velocity);
    }

    positionAt (seconds, resolution = 0.01) {
        if (seconds <= 0) return new Vector(this.origin);
        const position = new Vector(this.origin);
        const velocity = this.velocity.clone();
        let t = 0;
        while (t < seconds) {
            const dt = Math.min(resolution, seconds - t);            
            const v = velocity.mul(-this.drag * Math.sqrt(velocity.pow(2).sum()));
            
            velocity.add(this.acceleration.add(v).mul(dt), true);
            position.add(velocity.mul(dt), true);
            t += dt;
        }

        return position;
    }
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
                acceleration: new Vector(20, 200),
                drag: 0.001,
                radius: 5,
                blastRadius: 30
            };
        super(origin, Direction(angle).mul(config.initalSpeed * power), config.acceleration, config.drag);
        this.config = config;
        const currentPosition = this.current.position;
        this.#shape = new Circle(currentPosition, config.radius, resolution);
        this.#blast = {
            color: new Color("#FFD300"),
            _shapes: [new Circle(currentPosition, config.blastRadius, resolution)],
            get shapes () {
                return this.shapesAt(currentPosition);
            },
            shapesAt: function (position) {
                return Array.from(this._shapes, (shape) => shape.translate(position));
            },
            draw: function (ctx) {
                for (const shape of this.shapes) {
                    ctx.fillStyle = this.color;
                    shape.draw(ctx);
                    ctx.fill();
                }
            }
        };
        this.color = new Color("#FF0000");
    }

    update (seconds = 1) {
        super.update(seconds);
        this.#shape.updatePath();
    }

    draw (ctx) {
        ctx.fillStyle = this.color;
        this.shape.draw(ctx);
        ctx.fill();
    }

    intersectAt (polygon, step = .01 , resolution = .01) { // the projectiles position when it's shape intersects with the given terrain
        if (!polygon.isPolygon) throw new Error("[BasicShot] Error: Cannot perform intersection operation with non-Polygon");
        const circle = new Circle(this.origin.clone(), this.#shape.radius, this.#shape.resolution);
        const points = [...polygon.path];
        const bounds = new Vector(
            Math.max(points.map(({x}) => x)),
            Math.max(points.map(({y}) => y))
        );
        let seconds = 0;
        while (!polygon.isIntersecting(circle)) {
            if (circle.position.x > bounds.x
                || circle.position.x < 0
                || circle.position.y > bounds.y
                || circle.position.y < 0
            ) return undefined;
            circle.position = this.positionAt(seconds, resolution);
            seconds += step;
        }
        return circle.position.clone(); // return new instance of Vector, garbage collect everything else used here (hopefully)
    }

    get shape () { return this.#shape }
    get blast () { return this.#blast }
}

function drawFill (ctx) {
    console.log(this);
    
}
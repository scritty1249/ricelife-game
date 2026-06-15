import { Projectile, BasicShot } from "./default.js";
import { Circle, Vector, Direction, Color, Path } from "../geometry/geometry.js";
import { deg2rad, averageAngle } from "../utils/utils.js";

export { BasicShot } from "./default.js";

export class Spreader extends BasicShot {
    static initalSpeed = 400;
    static acceleration = new Vector(20, -200);
    static drag = 0.001;
    static radius =  7.5;
    static blastRadius = 25;
    static glowColor = new Color(0, 212, 255);
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);

        this.blast.blasts.splice(0, this.blast.blasts.length);
        this.blast.push(new Circle(new Vector(), this.blastRadius, this.resolution), 0);
        this.blast.push(new Circle(new Vector(-this.blastRadius * 1.75, 0), this.blastRadius, this.resolution), 250);
        this.blast.push(new Circle(new Vector(this.blastRadius * 1.75, 0), this.blastRadius, this.resolution), 500);
    }

    clone () { return new Spreader(this.origin, this.angle, this.power, this.resolution) }
}

export class Flower extends BasicShot {
    static initalSpeed = 400;
    static acceleration = new Vector(20, -200);
    static drag = 0.001;
    static radius =  7.5;
    static blastRadius = 35;
    static glowColor = new Color(255, 215, 0);
    static glowRadius = 20;
    static glowResolution = 3;
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);

        this.blast.blasts.splice(0, this.blast.blasts.length);
        Array.from([0, 360/7, 720/7, 1080/7, 1440/7, 1800/7, 2160/7], (angle, i) => {
            const rad = deg2rad(angle);
            return new Circle(new Vector(Math.cos(rad), Math.sin(rad)).mul(this.radius + (this.blastRadius * 1.75)), this.blastRadius, this.resolution)})
            .forEach((shape, i) => this.blast.push(shape, i * 100));
    }

    clone () { return new Flower(this.origin, this.angle, this.power, this.resolution) }
}

export class Digger extends BasicShot {
    static initalSpeed = 500;
    static acceleration = new Vector(10, -300);
    static drag = 0.003;
    static radius =  8;
    static blastRadius = 30;
    static glowColor = new Color(210, 165, 0);
    static mainColor = new Color(200, 90, 0);
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);

        this.blast.blasts.splice(0, this.blast.blasts.length);
        this.blast.push(new Circle(new Vector(), this.blastRadius, this.resolution), 0);
        this.blast.push(new Circle(new Vector(0, -this.blastRadius * 1.75), this.blastRadius, this.resolution), 400);
        this.blast.push(new Circle(new Vector(0, -this.blastRadius * 1.75 * 2), this.blastRadius, this.resolution), 800);
        this.blast.push(new Circle(new Vector(0, -this.blastRadius * 1.75 * 3), this.blastRadius, this.resolution), 1200);
    }

    clone () { return new Digger(this.origin, this.angle, this.power, this.resolution) }
}

export class Bouncer extends BasicShot {
    static collisionBehavior = function (intersections) {
        if (this.#bounces < this.#maxBounces) {
            // reflection calculation
            const segments = new Path();
            for (const { overlap } of intersections)
                for (const segment of overlap)
                    segments.push(...segment); // flatten array
            if (segments.length > 1) {
                const direction = this.current.velocity.clone();
                const normal = segments.normal();
                const reflection = direction.sub(normal.mul(2 * direction.dot(normal)));

                // debugging, record last bounce calculations
                const state = this.bounceState;
                state.normal.apply(normal);
                state.direction.apply(direction);
                state.reflection.apply(reflection);
                state.point.apply(this.position);
                // apply cosmetic updates
                const reduce = this.glowReduction / this.#maxBounces;
                this.glowColor.r -= reduce;
                this.glowColor.g -= reduce;
                this.glowColor.b -= reduce;
                // update projectile
                this.current.velocity.apply(reflection);
                this.#bounces++;
                return false;
            } else {
                // if there are no overlapping segments, projectile is stuck INSIDE of a colliding polygon. Don't bounce
                return true;
            }
        }
        return true;
    }
    static glowReduction = 50;
    static glowColor = new Color(128, 0, 128);
    static maxBounces = 3;
    bounceState = { // [!] mainly for debugging
        normal: new Vector(),
        direction: new Vector(),
        reflection: new Vector(),
        point: new Vector(),
        clone: function () {
            return {
                normal: this.normal.clone(),
                direction: this.direction.clone(),
                reflection: this.reflection.clone(),
                point: this.point.clone()
            }
        }
    };
    glowReduction;
    #maxBounces;
    #bounces = 0;
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        this.#maxBounces = new.target.maxBounces || Bouncer.maxBounces;
        this.glowReduction = new.target.glowReduction || Bouncer.glowReduction;
    }

    // [!] overrided mainly for debugging
    intersectAt (polygons, increment = 1/60, limit = 1000) {
        if (polygons.some(({isPolygon}) => !isPolygon)) throw new Error(`[${this.constructor.name}] Error: Cannot perform intersection operation with non-Polygon`);
        const proj = this.clone(true);
        const result = { intersect: false, bounces: [] };
        const state = proj.bounceState;
        let bounceCount;
        for (let t = 0; t < limit && !result.intersect; t += increment) {
            bounceCount = proj.bounces;
            proj.update(increment, polygons);
            if (bounceCount != proj.bounces)
                result.bounces.push(state.clone());
            if (proj.isColliding) {
                result.point = proj.position.clone()
                result.at = t;
                result.intersect = true;
            }
        }
        return result;
    }
    
    clone () { return new Bouncer(this.origin, this.angle, this.power, this.resolution) }

    get bounces () { return this.#bounces }
}

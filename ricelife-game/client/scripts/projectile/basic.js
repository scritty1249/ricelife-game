import { Projectile, BasicShot, Blast } from "./default.js";
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
    static glowColor = new Color(255, 215, 0);
    static glowRadius = 20;
    static glowResolution = 3;
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);

        const blastRadius = 35;
        this.hitbox.splice(0, this.hitbox.length);
        Array.from([0, 360/7, 720/7, 1080/7, 1440/7, 1800/7, 2160/7], (angle, i) => {
            const rad = deg2rad(angle);
            return new Circle(new Vector(Math.cos(rad), Math.sin(rad)).mul(this.radius + (blastRadius * 1.75)), blastRadius, this.resolution)})
            .forEach((shape, i) => this.hitbox.push(new Blast(shape, i * 100)));
    }

    clone () { return new Flower(this.origin, this.angle, this.power, this.resolution) }
}

export class Digger extends BasicShot {
    static initalSpeed = 500;
    static acceleration = new Vector(10, -300);
    static drag = 0.003;
    static radius =  8;
    static glowColor = new Color(210, 165, 0);
    static mainColor = new Color(200, 90, 0);
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);

        const blastRadius = 30;
        this.hitbox.splice(0, this.hitbox.length);
        this.hitbox.push(new Blast(new Circle(new Vector(), blastRadius, this.resolution), 0));
        // this.hitbox.push(new Blast(new Circle(new Vector(-blastRadius * 1.75), blastRadius, this.resolution), 400));
        // this.hitbox.push(new Blast(new Circle(new Vector(-blastRadius * 1.75 * 2), blastRadius, this.resolution), 800));
        // this.hitbox.push(new Blast(new Circle(new Vector(-blastRadius * 1.75 * 3), blastRadius, this.resolution), 1200));

        for (let i = 1; i < 4; i++) {
            const blast = this.hitbox.at(0).clone(true);
            blast.delay = 400 * i;
            blast.shape.position.y = -blastRadius * 1.75 * i;
            this.hitbox.push(blast);
        }
    }

    clone () { return new Digger(this.origin, this.angle, this.power, this.resolution) }
}

export class Bouncer extends BasicShot {
    static collisionBehavior (intersections) {
        if (this.#bounces < this.maxBounces) {
            // reflection calculation
            const segments = new Path();
            for (const { overlap } of intersections)
                for (const segment of overlap)
                    segments.push(...segment); // flatten array
            if (segments.length > 1) {
                const direction = this.current.velocity.clone();
                const normal = segments.normal();
                // check for errors- invert normal if current position is on the wrong segment "side"
                if (direction.dot(normal) > 0) normal.mul(-1, true);

                const reflection = direction
                    .sub(normal.mul(2 * direction.dot(normal)))
                    .mul(this.bounceVelocityMultiplier);
                this.onBounce();
                // debugging, record bounce calculations
                this.previousBounces.push({ direction, normal, reflection, point: this.position.clone() });
                // update projectile
                this.position.add(normal, true);
                this.current.velocity.apply(reflection);
                this.#bounces++;
                // callback
                this.onBounceCallback?.();
                return;
            } else {
                // if there are no overlapping segments, projectile is stuck INSIDE of a colliding polygon. Don't bounce
                console.warn(`[${this.constructor.name}]: Collided with inside of Polygon - stopping bounces`);
            }
        }
        this.current.velocity.mul(0, true);
        this.applyBlast();
    }
    static onBounce () {
        // apply cosmetic updates
        const reduce = this.bounceGlowReduction / this.maxBounces;
        this.glowColor.r -= reduce;
        this.glowColor.g -= reduce;
        this.glowColor.b -= reduce;
    }
    static onBounceCallback () {} // this does not apply to Projectile tracing performed by web workers. Operations done in this callback should be cosmetic-only: should NOT change projectile movement or hitbox
    static bounceVelocityMultiplier = new Vector(.9, .9);
    static glowColor = new Color(128, 0, 128);
    static mainColor = new Color(255, 240, 255);
    static maxBounces = 5;
    #maxBounces;
    #bounces = 0;
    previousBounces = new Array();
    bounceGlowReduction = 50;
    bounceVelocityMultiplier;
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        this.#maxBounces = new.target.maxBounces || Bouncer.maxBounces;
        this.bounceVelocityMultiplier = (new.target.bounceVelocityMultiplier || Bouncer.bounceVelocityMultiplier).clone();
        this.onBounceCallback = (new.target.onBounceCallback || Bouncer.onBounceCallback).bind(this);
        this.onBounce = (new.target.onBounce || Bouncer.onBounce).bind(this);
    }

    // [!] overrided mainly for debugging
    intersectAt (polygons, increment = 1/60, limit = 1000, float64 = false) {
        const result = super.intersectAt(polygons, increment, limit, float64);
        result.bounces = result.state.previousBounces;
        return result;
    }
    
    clone () { return new Bouncer(this.origin, this.angle, this.power, this.resolution) }

    get bounces () { return this.#bounces }
    get maxBounces () { return this.#maxBounces }
}

export class MegaBouncer extends Bouncer {
    static onBounce () {
        // apply cosmetic updates
        const brighten = this.bounceGlowLimit / this.maxBounces;
        this.glowColor.r += brighten;
        this.glowColor.g += brighten;
        this.glowColor.b += brighten;
        const grow = this.bounceGlowRadiusLimit / this.maxBounces;
        this.glowRadius += grow;
        this.glowColor.a *= this.bounceGlowAlphaMultiplier;
        // functional updates
        const radius = this.bounceBlastRadiusLimit / this.maxBounces;
        this.hitbox.forEach((blast) => blast.radius += radius);
        const tail = this.bounceTailLengthLimit / this.maxBounces;
        this.tailLength += tail;
        const acceleration = this.bounceAccelerationLimit.div(this.maxBounces);
        this.acceleration.add(acceleration);
    }
    static bounceVelocityMultiplier = new Vector(1.1, 1.3);
    static initalSpeed = 500;
    static acceleration = new Vector(30, -200);
    static drag = 0.002;
    static maxBounces = 3;
    static radius = 15;
    bounceAccelerationLimit = new Vector(-10, -75);
    bounceTailLengthLimit = 15;
    bounceGlowLimit = 40;
    bounceGlowAlphaMultiplier = .7;
    bounceGlowRadiusLimit = 50;
    bounceBlastRadiusLimit = 30;
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
        this.hitbox.at(0).radius = 30;
        this.glowColor.a = 100;
    }

    clone () { return new MegaBouncer(this.origin, this.angle, this.power, this.resolution) }
}

export class MegaBouncer2 extends MegaBouncer {
    static onBounce () {
        this.applyBlast();
        super.onBounce();
    }
    constructor (origin, angle, power = 1, resolution = 1) {
        super(origin, angle, power, resolution);
    }

    clone () { return new MegaBouncer2(this.origin, this.angle, this.power, this.resolution) }
}
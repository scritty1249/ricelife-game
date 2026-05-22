import { Projectile } from "./default.js";
import { Circle, Vector, Direction, Color } from "../geometry/geometry.js";

export class BasicShot extends Projectile {
    #shape;
    constructor (origin, angle, power = 1, resolution = 1) {
        const initalSpeed = 400,
            acceleration = new Vector(20, 200),
            drag = 0.001,
            radius = 2;
        super(origin, Direction(angle).mul(initalSpeed), acceleration, drag);
        this.#shape = new Circle(this.current.position, radius, resolution);
        this.color = new Color("#FF0000");
    }

    update (seconds = 1) {
        super.update(seconds);
        this.#shape.updatePath();
    }

    draw (ctx) {
        ctx.fillStyle = this.color;
        this.#shape.draw(ctx);
        ctx.fill();
    }

    get shape () { return this.#shape }
}
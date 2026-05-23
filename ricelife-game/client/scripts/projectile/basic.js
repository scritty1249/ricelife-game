import { Projectile } from "./default.js";
import { Circle, Vector, Direction, Color } from "../geometry/geometry.js";

export class BasicShot extends Projectile {
    #shape;
    #blast;
    constructor (origin, angle, power = 1, resolution = 1) {
        const initalSpeed = 400,
            acceleration = new Vector(20, 200),
            drag = 0.001,
            radius = 5,
            blastRadius = 30;
        super(origin, Direction(angle).mul(initalSpeed * power), acceleration, drag);
        const currentPosition = this.current.position;
        this.#shape = new Circle(currentPosition, radius, resolution);
        this.#blast = {
            color: new Color("#FFD300"),
            get shape () {
                return this.shapeAt(currentPosition);
            },
            shapeAt: function (position) {
                return new Circle(position, blastRadius, resolution);
            },
            draw: function (ctx) {
                ctx.fillStyle = this.color;
                this.shape.draw(ctx);
                ctx.fill();
            },
            
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
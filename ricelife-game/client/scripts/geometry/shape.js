import { Polygon } from "./polygon.js";
import { Path } from "./path.js";
import { Vector } from "./vector.js";

export class TrackingShape extends Polygon {
    #follow;
    constructor (offsetPosition, followShape) {
        super();
        this.offset = offsetPosition;
        this.#follow = followShape
        if (new.target.shape)
            this.updatePath = new.target.shape.prototype.updatePath.bind(this);
    }
    get position () { return this.#follow.position.add(this.offset) }
    get follow () { return this.#follow }
}

export class Circle extends Polygon {
    constructor (position, radius, resolution = 1) {
        super();
        this.position = position;
        this.radius = radius;
        this.resolution = resolution;

        this.updatePath();
    }

    updatePath () { // update path to be relative to position
        const steps = Math.floor(360 / this.resolution);
        this.path.apply(...Array.from({length: steps}, (_, i) => {
            const angle = (i * 2 * Math.PI) / steps; 
            return this.position.add({
                x: this.radius * Math.cos(angle),
                y: this.radius * Math.sin(angle)
            })
        }));
    }

    get isCircle () { return true }
    clone () { return new Circle(this.position.clone(), this.radius, this.resolution) }
}

export class TrackingCircle extends TrackingShape {
    static shape = Circle;
    constructor (position, radius, followShape) {
        super(position, followShape);
        this.radius = radius;
        this.resolution = followShape.resolution;
        this.updatePath();
    }

    clone () { return new TrackingCircle(this.offset.clone(), this.radius, this.follow) }
}

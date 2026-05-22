import { Polygon } from "./polygon.js";
import { Path } from "./path.js";

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
}

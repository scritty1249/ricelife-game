import { Polygon } from "./polygon.js";
import { Path } from "./path.js";
import { Vector, Direction } from "./vector.js";

export class Shape extends Polygon {
    #positionProxy;
    constructor (position, resolution = 1) {
        super();
        this.resolution = resolution;
        this._position = position;
        this.#positionProxy = new Proxy(this._position, {
            set: (target, prop, value, reciever) => {
                const result = Reflect.set(target, prop, value, reciever);
                this.updatePath();
                return result;
            },
            get: (target, prop, receiver) => {
                const value = Reflect.get(target, prop, receiver);
                if (typeof value === "function") {
                    return (...args) => {
                        const result = value.apply(target, args);
                        this.updatePath();
                        return result;
                    };
                }
                return value;
            }
        });
    }

    translate(translate, mutate = false) {
        const translated = super.translate(translate, mutate);
        translated.position.add(translate, true);
        return translated;
    }

    updatePath () {
        for (const point of this.path)
            point.add(this._position, true);
    }

    draw (ctx, close = true) {
        this.updatePath();
        super.draw(ctx, close);
    }

    clone () { return new Shape(this.position.clone(), this.resolution) }

    get isShape () { return true }
    get position () { return this.#positionProxy }
}

export class Circle extends Shape {
    constructor (position, radius, resolution = 1) {
        super(position, resolution);
        this.radius = radius;
        this.updatePath(); // call once to initalize the shape
    }

    updatePath () { // update path to be relative to position
        const steps = Math.floor(360 / this.resolution);
        this.path.apply(...Array.from({length: steps}, (_, i) => {
            const angle = (i * 2 * Math.PI) / steps; 
            return this._position.add({
                x: this.radius * Math.cos(angle),
                y: this.radius * Math.sin(angle)
            })
        }));
    }

    get isCircle () { return true } // [!] may be redundant, depending on how specific we get with geometry later on...
    clone () { return new Circle(this.position.clone(), this.radius, this.resolution) }
}

export class Triangle extends Shape {
    // position is going to be the tip of the triangle, which extends BELOW the origin point
    constructor (position, size, resolution = 1) {
        super(position, resolution);
        this.size = size;
        this.angle = 0; // radians
        this.updatePath();
    }

    updatePath () {
        const { _position: position } = this;
        const centerBase = position.add(Direction(this.angle, false).mul(this.size.y));
        const prependicularOffset = Direction(this.angle + (Math.PI / 2), false)
            .mul(this.size.x);
        this.path.apply(position.clone(), centerBase.add(prependicularOffset), centerBase.sub(prependicularOffset));
    }

    get basePoint () { return this.position.add(Direction(this.angle, false).mul(this.size.y)) } // center of bottom
    get isTriangle () { return true } // [!] may be redundant, depending on how specific we get with geometry later on...
    clone () { return new Triangle(this.position.clone(), this.size.clone(), this.resolution) }
}
import { Polygon } from "./polygon.js";
import { Path } from "./path.js";
import { Vector } from "./vector.js";

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


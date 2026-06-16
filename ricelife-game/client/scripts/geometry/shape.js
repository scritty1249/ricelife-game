import { Polygon } from "./polygon.js";
import { Path } from "./path.js";
import { Vector, Direction } from "./vector.js";
import { floatEqual } from "../utils/utils.js";

export class Shape extends Polygon {
    #position = new Vector();
    #scale = new Vector(1, 1);
    #rotation = 0; // radians
    #scaleProxy = new Proxy(this.#scale, {
        set: (target, prop, value, reciever) => {
            const prev = this.#scale.clone();
            const result = Reflect.set(target, prop, value, reciever);
            if (!this.#scale.eq(prev))
                this.#applyScaleChange(prev);
            return result;
        },
        get: (target, prop, receiver) => {
            const value = Reflect.get(target, prop, receiver);
            if (typeof value === "function") {
                const self = this;
                const curr = this.#scale;
                const prev = this.#scale.clone();
                return (...args) => {
                    const result = value.apply(target, args);
                    if (!curr.eq(prev))
                        self.#applyScaleChange(prev);
                    return result;
                };
            }
            return value;
        }
    });
    #positionProxy = new Proxy(this.#position, {
        set: (target, prop, value, reciever) => {
            const prev = this.#position.clone();
            const result = Reflect.set(target, prop, value, reciever);
            if (!this.#position.eq(prev))
                this.#applyPositionChange(this.#position.sub(prev));
            return result;
        },
        get: (target, prop, receiver) => {
            const value = Reflect.get(target, prop, receiver);
            if (typeof value === "function") {
                const self = this;
                const curr = this.#position;
                const prev = this.#position.clone();
                return (...args) => {
                    const result = value.apply(target, args);
                    if (!curr.eq(prev))
                        self.#applyPositionChange(curr.sub(prev));
                    return result;
                };
            }
            return value;
        }
    });

    constructor (position, ...points) {
        super(...points);
        this.#position.apply(position);
        if (!(floatEqual(position.x, 0) && floatEqual(position.y, 0)))
            this.#applyPositionChange(position);
    }

    #applyScaleChange (previousScale) {
        if (this.path.length === 0) return;
        this.translate(this.#position.mul(-1), true); 
        this.path.forEach((pt) => pt.div(previousScale, true).mul(this.#scale, true));
        this.translate(this.#position, true);
    }
    #applyRotationChange (difference) {
        if (this.path.length === 0) return;
        this.path.forEach((pt) => pt.pivot(difference, this.#position, true));
    }
    #applyPositionChange (difference) {
        if (this.path.length === 0) return;
        this.translate(difference, true);
    }

    apply (scale, rotation, translation) {
        this.#scale.apply(scale);
        this.#rotation = rotation;
        this.#position.apply(translation);
        this.path.forEach((pt) => pt
            .mul(scale, true)
            .add(translation, true)
            .pivot(rotation, translation, true));
        return this; // for chaining
    }
    clone (deep = false) {
        const position = deep ? this.position.clone(true) : this.position;
        const shape = new Shape(position);
        const path = deep ? this.path.clone(true) : this.path;
        for (const point of path) shape.path.push(point);
        return shape;
    }

    get isShape () { return true }
    get position () { return this.#positionProxy }
    get scale () { return this.#scaleProxy }
    get rotation () { return this.#rotation } // radians
    set rotation (radians) {
        if (!floatEqual(radians, this.#rotation))
            this.#applyRotationChange(radians - this.#rotation);
        return (this.#rotation = radians);
    }

    static fromObject (position, polyData) { // only converts topmost path to Shape. Holes are still polygons
        const shape = new Shape(Vector.fromObject(position), Path.fromArray(polyData.path))
        if (polyData.depth)
            for (const hole of polyData.holes) {
                const poly = super.fromObject(hole, polyData.depth - 1);
                if (poly.path.isClockwise) poly.path.points.reverse();
                shape.holes.push(poly);
            }
        return shape;
    }
}

export class Circle extends Shape {
    #radius;
    #resolution;
    constructor (position, radius, resolution = 1) {
        super(position);
        this.#radius = radius;
        this.#resolution = resolution;
        this.#applyPath();
    }

    #applyPath () {
        const path = this.path;
        path.apply();
        for (let i = 0; i < 360; i += this.resolution) {
            const angle = (i * 2 * Math.PI) / 360;
            path.push(
                new Vector(
                    this.radius * Math.cos(angle),
                    this.radius * Math.sin(angle)
                )
            );
        }
        this.apply(this.scale, this.rotation, this.position);
    }

    clone () {
        const circle = new Circle(this.position.clone(), this.radius, this.resolution);
        circle.rotation = this.rotation;
        circle.scale.apply(this.scale);
        return circle;
    }
    isIntersecting (value, ignoreholes = false) {
        if (value?.isVector) {
            return this.position.distance(value) <= this.radius && (ignoreholes || !this.holes.some((hole) => hole.isIntersecting(value, !ignoreholes)));
        } else if (value?.isPolygon) {
            return value.path.points.some((point) =>
                this.position.distance(point) <= this.radius && (ignoreholes || !this.holes.some((hole) => hole.isIntersecting(value, !ignoreholes))))
                && this.path.points.some((point) => value.isIntersecting(point, ignoreholes));
        } else if (value?.isPath) {
            return value.points.some((point) =>
                this.position.distance(point) <= this.radius && (ignoreholes || !this.holes.some((hole) => hole.isIntersecting(value, !ignoreholes))));
        } else
            return super.isIntersecting(value, ignoreholes);
    }

    get isCircle () { return true } // [!] may be redundant, depending on how specific we get with geometry later on...
    get radius () { return this.#radius }
    set radius (value) {
        const result = (this.#radius = value);
        this.#applyPath();
        return result;
    }
    get resolution () { return this.#resolution }
    set resolution (value) {
        const result = (this.#resolution = value);
        this.#applyPath();
        return result;
    }
}

export class Triangle extends Shape {
    #size = new Vector();
    #sizeProxy = new Proxy(this.#size, {
        set: (target, prop, value, reciever) => {
            const prev = this.#size.clone();
            const result = Reflect.set(target, prop, value, reciever);
            if (!prev.eq(this.#size))
                this.#applySize();
            return result;
        },
        get: (target, prop, receiver) => {
            const value = Reflect.get(target, prop, receiver);
            if (typeof value === "function") {
                const self = this;
                const curr = this.#size;
                const prev = this.#size.clone();
                return (...args) => {
                    const result = value.apply(target, args);
                    if (!prev.eq(curr))
                        self.#applySize();
                    return result;
                };
            }
            return value;
        }
    });
    // position is going to be the tip of the triangle, which extends BELOW the origin point
    constructor (position, size) {
        super(position);
        this.#size.apply(size);
        this.#applySize();
    }

    #applySize() {
        const perpendicularOffset = this.#size.x / 2;
        this.path.apply(
            new Vector(),
            new Vector(perpendicularOffset,  -this.#size.y),
            new Vector(-perpendicularOffset,  -this.#size.y)
        );
        this.apply(this.scale, this.rotation, this.position);
    }

    get basePoint () { return this.position.add(Direction(this.rotation, false).mul(this.size.y)) } // center of bottom
    get isTriangle () { return true } // [!] may be redundant, depending on how specific we get with geometry later on...
    get size () { return this.#sizeProxy }
    clone () {
        const triangle = new Triangle(this.position.clone(), this.size.clone());
        triangle.rotation = this.rotation;
        triangle.scale.apply(this.scale);
        return triangle;
    }
}
import { Polygon } from "./Polygon.js";
import { Shape } from "./Shape.js";

// wraps Polygon, for anything we can't classify as a Circle or Triangle (optimize/workaround for "compound" shapes when computing intersections)
export class Poly extends Shape {
    static get TYPE () { return 2 }
    static fromObject (payload) {
        const { blob, globalTransform } = payload;
        const polygon = Polygon.fromObject(blob, blob.depth);
        const poly = new Poly(polygon);
        poly.globalTransform.apply(Transform.fromObject(globalTransform));
        return poly;
    }
    constructor (polygon) {
        super();
        this.blob.polygon = polygon || new Polygon();
    }

    #isShapeInside (value) {
        const points = this.polygon.edgePoints;
        // if any hole intersects with the Shape, it is not wholly "inside"
        if (this.polygon.holes.some((hole) => value.isPolygonIntersecting(hole))) return false;
        // otherwise, if no holes intersect with Shape, just need to check that every point in the Shape intersects with the Polygon
        return this.polygon.isIntersecting(value.Polygon(1));
    }

    isVectorIntersecting (value) {
        return this.polygon.isIntersecting(value);
    }
    isCircleIntersecting (value) {
        return value.isPolygonIntersecting(this.polygon);
    }
    isTriangleIntersecting (value) {
        return value.isPolygonIntersecting(this.polygon);
    }
    isPathInside (value) {
        if (!this.isPathIntersecting(value)) return false;
        const paths = this.polygon.edges;
        for (const path of paths)
            if (path.isIntersecting(path)) return false;
        return true;
    }
    isCircleInside (value) {
        return this.#isShapeInside(value);
    }
    isTriangleInside (value) {
        return this.#isShapeInside(value);
    }
    Polygon (resolution = 1) {
        const polygon = this.polygon.clone(true);
        polygon.subsection(resolution);
        return polygon;
    }
    decode () {
        const decoded = super.decode();
        const data = this.polygon.Float32(this.polygon.depth);
        for (const buffer of data.buffers) decoded.buffers.push(buffer);
        delete data.buffers;
        decoded.data.blob = data;
        return decoded;
    }
    draw (cursor) {
        this.polygon.draw(cursor);
    }
    applyTransform () {
        // center at (0, 0)
        const offset = this.polygon.center;
        for (const point of this.polygon.path) {
            point.sub(offset, true);
            this.transform.set(point, true);
            point.add(offset, true);
        }
        super.applyTransform(); // reset transforms
    }
    clone () { // does not carry over pending transforms
        const poly = new Poly(this.blob.polygon.clone(true));
        return poly;
    }
    getBoundingBox () { return this.polygon.getBoundingBox() }

    get isPoly () { return true }
    get origin () { return this.polygon.center }
    get center () { return this.polygon.center }
    get polygon () { return this.blob.polygon }
    get blobRawHash () { return this.blob.polygon.rawHash }
}

Shape.TYPES.set(Poly.TYPE, Poly);

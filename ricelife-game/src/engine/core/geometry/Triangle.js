import { Shape } from "./Shape.js";
import { Vector } from "../math/Vector.js";
import { Path } from "../math/Path.js";
import { Polygon } from "./Polygon.js";

// equilateral triangle, centered at the topmost point
export class Triangle extends Shape {
    static #LEG_Y = -1 * Math.sqrt(3) / 2;
    static #POINTS = { // [!] never modify
        origin: new Vector(0, 0),
        right: new Vector(.5, Triangle.#LEG_Y),
        left: new Vector(-.5, Triangle.#LEG_Y)
    };
    static get TYPE () { return 1 }
    static fromObject (payload) {
        const { blob, globalTransform } = payload;
        const { origin, right, left } = blob;
        const triangle = new Triangle();
        triangle.blob.origin.apply(origin.x, origin.y);
        triangle.blob.right.apply(right.x, right.y);
        triangle.blob.left.apply(left.x, left.y);
        triangle.globalTransform.apply(Transform.fromObject(globalTransform));
        return triangle;
    }
    #lastBboxHash;
    constructor () {
        super();
        this.blob.origin = Triangle.#POINTS.origin.clone();
        this.blob.right = Triangle.#POINTS.right.clone();
        this.blob.left = Triangle.#POINTS.left.clone();
        this.blob.path = new Path(this.blob.origin, this.blob.right, this.blob.left, this.blob.origin); // closed path for calculations / convenience
    }

    #pushLeg (point, distance) {
        const push = point
            .sub(this.blob.origin)
            .normalize(true)
            .mul(distance, true);
        point
            .apply(this.blob.origin)
            .add(push, true);
    }
    #getBottomCenterXY () { // more efficient - avoid allocation new Vector instances for every time we need these in-between calculations
        const { origin, right, left } = this.blob;
        return [
            (left.x + right.x) / 2,
            (left.y + right.y) / 2
        ];
    }
    isVectorIntersecting (value) {
        const { origin, right, left } = this.blob;
        // cross product of edges
        // edges are: origin -> right, right -> left, left -> origin
        const or = right.sub(origin).cross(point.sub(origin));
        const rl = left.sub(right).cross(point.sub(right));
        const lo = origin.sub(left).cross(point.sub(left));
        // point must be on the same side of all triangle legs. Triangle legs are arranged clockwise, so point should always be on the right of every edge
        return or <= 0 && rl <= 0 && lo <= 0;
    }
    isPathIntersecting (value) {
        return value.isIntersecting(this.blob.path);
    }
    isPolygonIntersecting (value) {
        const { origin, right, left } = this.blob;
        if (value.isIntersecting(origin)
            || value.isIntersecting(right)
            || value.isIntersecting(left) // default check
            || super.isPolygonIntersecting(value)) return true;
        else return false;
    }
    isTriangleIntersecting (value) {
        if (this.blob.path.isIntersecting(value.blob.path)) return true;
        else if (this.isVectorIntersecting(value.origin) || value.isIntersecting(this.origin)) return true;
        else return false;
    }
    isCircleInside (value) {
        const { path } = this.blob;
        if (!this.isVectorIntersecting(value.origin)) return false;
        if (value.isIntersecting(path)) return false;
        return true;
    }
    isTriangleInside (value) {
        return this.isPathInside(value.blob.path);
    }
    Polygon (resolution = 1) {
        const { origin, right, left } = this.blob;
        // polygons need to be in clockwise order
        return new Polygon(origin, right, left).subsection(resolution);
    }
    applyTransform () {
        const { origin, right, left } = this.blob;
        const { offset, scale, rotation } = this.transform;
        const r = right.sub(origin);
        const l = left.sub(origin);
        // transforms should be relative to origin
        origin.add(offset, true);
        right.apply(origin).add(r.mul(scale, true).rotate(rotation, true), true);
        left.apply(origin).add(l.mul(scale, true).rotate(rotation, true), true);
        super.applyTransform(); // reset transforms
    }
    draw (cursor, close = true) {
        const { origin, right, left } = this.blob;
        const { transform } = this;
        const precision = this.constructor.DRAW_PRECISION;
        // account for canvas orientation
        transform.save();
        transform.reset();
        transform.angle = Math.PI / 2;
        this.applyTransform();

        if (close) cursor.beginPath();
        cursor.moveTo(origin.precision(precision));
        cursor.lineTo(right.precision(precision));
        cursor.lineTo(left.precision(precision));
        if (close) cursor.closePath();

        transform.angle = -Math.PI / 2;
        this.applyTransform();
        transform.restore();
    }
    clone () { // does not carry over pending transforms
        const triangle = new Triangle();
        triangle.blob.origin.apply(this.blob.origin);
        triangle.blob.right.apply(this.blob.right);
        triangle.blob.left.apply(this.blob.left);
        return triangle;
    }
    getBoundingBox () {
        const bbox = super.getBoundingBox();
        const { path, origin } = this.blob;
        const hash = path.hash;
        if (this.#lastBboxHash === hash) return bbox;
        bbox.min.apply(origin);
        bbox.max.apply(origin);
        for (const point of path) {
            if (point.x > bbox.max.x) bbox.max.x = point.x;
            if (point.y > bbox.max.y) bbox.max.y = point.y;
            if (point.x < bbox.min.x) bbox.min.x = point.x;
            if (point.y < bbox.min.y) bbox.min.y = point.y;
        }
        this.#lastBboxHash = hash;
        return bbox;
    }

    get isTriangle () { return true }
    // get / set leg lengths
    get height () {
        const { origin, right, left } = this.blob;
        const [ centerX, centerY ] = this.#getBottomCenterXY();
        return Math.hypot(centerX - origin.x, centerY - origin.y);
    }
    set height (value) { // push left and right legs without affecting bottomLength
        const { origin, right, left } = this.blob;
        const { rotation } = this.transform;
        const [ centerX, centerY ] = this.#getBottomCenterXY();
        const widthX = right.x - centerX;
        const widthY = right.y - centerY;
        const bottomCenter = origin.sub(rotation.mul(value));
        right.apply(bottomCenter.x + widthX, bottomCenter.y + widthY);
        left.apply(bottomCenter.x - widthX, bottomCenter.y - widthY);
        return value;
    }
    get bottomLength () { return this.blob.left.distance(this.blob.right) }
    set bottomLength (value) {
        const { right, left } = this.blob;
        const { rotation } = this.transform;
        const [ centerX, centerY ] = this.#getBottomCenterXY();
        // get axis legs sit on, multiply by half of length to get distance
        const distance = rotation.transpose();
        distance.x *= -1;
        distance.mul(value / 2, true);
        right.apply(centerX, centerY).add(distance, true);
        left.apply(centerX, centerY).sub(distance, true);
        return value;
    }
    get rightLength () { return this.blob.origin.distance(this.blob.right) }
    set rightLength (value) {
        this.#pushLeg(this.blob.right, value);
        return value;
    }
    get leftLength () { return this.blob.origin.distance(this.blob.left) }
    set leftLength (value) {
        this.#pushLeg(this.blob.left, value);
        return value;
    }
    get origin () { return this.blob.origin }
    get center () {
        const { origin, right, left } = this.blob;
        return origin.add(right).add(left, true).div(3, true);
    }
    get blobRawHash () { return this.blob.path.rawHash }
}

Shape.TYPES.set(Triangle.TYPE, Triangle);

import { Polygon } from "./polygon.js";
import { Path, BoundingBox } from "./path.js";
import { Vector } from "./vector.js";
import { floatEqual } from "../utils/utils.js";

export class Transformation {
    static #DEFAULT = { // [!] never modify
        scl: new Vector(1, 1),
        off: new Vector(0, 0), // at origin
        rot: Vector.fromAngle(0) // point up
    };
    #scale = Transformation.#DEFAULT.scl.clone();
    #offset = Transformation.#DEFAULT.off.clone();
    #rotation = Transformation.#DEFAULT.rot.clone();
    #stack = new Array(); // save states, allow for save() and restore() calls
    constructor (scale = undefined, offset = undefined, rotation = undefined) {
        if (scale?.isVector) this.scale = scale;
        if (offset?.isVector) this.offset = offset;
        if (rotation?.isVector) this.rotation = rotation;
        else if (Number.isFinite(rotation)) this.angle = rotation;
    }

    // applies Transformation to a Vertex
    set (point, mutate = false) {
        if (!point?.isVector) throw new Error(`[${this.constructor.name}]: Cannot set transformation on non-Vector type ${typeof point}`);
        return point
            .mul(this.scale, mutate)
            .rotate(this.rotation, true)
            .add(this.offset, true);
    }
    // applies / copies another Transformation to this Transformation
    apply (transformation) {
        if (!transformation?.isTransformation) throw new Error(`[${this.constructor.name}]: Cannot apply from non-Transformation type ${typeof transformation}`);
        this.offset.apply(transformation.offset);
        this.rotation.apply(transformation.rotation);
        this.scale.apply(transformation.scale);
        return this; // for chaining
    }
    eq (transformation) {
        return transformation?.isTransformation
            && this.offset.eq(transformation.offset)
            && this.rotation.eq(transformation.rotation)
            && this.scale.eq(transformation.scale);
    }
    // compound transformations
    add (transformation, mutate = false) {
        if (!transformation?.isTransformation) throw new Error(`[${this.constructor.name}]: Cannot add non-Transformation type ${typeof transformation}`);
        const trans = mutate ? this : this.clone();
        trans.scale.mul(transformation.scale, true);
        trans.angle = trans.angle + transformation.angle;
        trans.offset.add(transformation.offset, true);
        return trans; // for chaining
    }
    reset () {
        this.scale.apply(Transformation.#DEFAULT.scl);
        this.offset.apply(Transformation.#DEFAULT.off);
        this.rotation.apply(Transformation.#DEFAULT.rot);
        return this; // for chaining
    }
    save () { this.#stack.push(this.clone()) }
    restore () { this.apply(this.#stack.pop()) }
    clone () { return new this.constructor(this.scale, this.offset, this.rotation) }
    toString() { return `[${this.constructor.name}] < Scale ${this.scale.toString()}, Offset ${this.offset.toString()}, Angle ${this.angle} >` }
    toJSON () { return {scale: this.scale.toJSON(), offset: this.offset.toJSON(), rotation: this.angle } } // pass rotation as radians (Number) to save memory

    get isTransformation () { return true }
    get hasUpdate () { return this.scale.eq(Transformation.#DEFAULT.scl) || this.offset.eq(Transformation.#DEFAULT.off) || this.rotation.eq(Transformation.#DEFAULT.rot) }
    get scale () { return this.#scale }
    set scale (value) { return this.#scale.apply(value) }
    get offset () { return this.#offset }
    set offset (value) { return this.#offset.apply(value) }
    get rotation () { return this.#rotation }
    set rotation (value) { return this.#rotation.apply(value) }
    // conversions to and from radians
    get angle () { return this.rotation.angle() }
    set angle (radians) {
        this.rotation = Vector.fromAngle(radians);
        return radians; // for chaining
    }
    static fromObject (obj) {
        const scale = Vector.fromObject(obj.scale);
        const offset = Vector.fromObject(obj.offset);
        const rotation = Vector.fromAngle(obj.angle);
        return new Transformation(scale, offset, rotation);
    }
}

export class Shape {
    static TYPES = new Array();
    static DRAW_PRECISION = 2; // during draw() calls, apply toFixed on coordinates to prevent flickering artifacts. Values greater than 4 may cause flickering depending on hardware. - KT
    #blob = {}
    #transform = new Transformation();
    #globalTransform = new Transformation(); // all transformations applied, compounded
    #bbox = new BoundingBox();
    constructor () {
        if (this.constructor === Shape) throw new Error(`[${this.constructor.name}]: Cannot be initalized from parent class`);
    }
    toJSON () { return {blob: this.blob, origin: this.origin.toJSON(), globalTransform: this.globalTransformation.toJSON(), type: this.constructor.TYPE} }
    decode () { return {isShape: true, data: this.toJSON(), buffers: []} }
    applyTransformation () { // children can manipulate blob data before super calling this methood
        if (!this.transformation.scale.isFinite
            || !this.transformation.offset.isFinite
            || !this.transformation.rotation.isFinite
        ) throw new Error(`[${this.constructor.name}]: Cannot apply transformation with corrupt values\n\t${this.transformation.toString()}`);
        if (this.transformation.hasUpdate)
            this.globalTransformation.add(this.transformation, true);
        this.transformation.reset();
    }
    overlap (other, flatten = false) {
        if (other?.isPolygon) return this.Polygon(1).overlap(other, flatten);
        else if (other?.isShape) return this.Polygon(1).overlap(other.Polygon(1), flatten);
        else throw new Error(`[${this.constructor.name}]: Cannot run overlap operation on unsupported type ${typeof other}`);
    }
    moveTo (x = null, y = null) { // move to point, instead of adding to transformation
        this.transformation.save();
        this.transformation.reset();
        if (x?.isVector) this.transformation.offset = x.sub(this.origin);
        else {
            if (Number.isFinite(x)) this.transformation.offset.x = x - this.origin.x;
            if (Number.isFinite(y)) this.transformation.offset.y = y - this.origin.y;
        }
        this.applyTransformation();
        this.transformation.restore();
    }
    getBoundingBox () { return this.#bbox }
    // [!] holy shit man
    // children should overload for optimizations, but not needed
    isPolygonIntersecting (value) { return value.isIntersecting(this.origin) || value.edgePoints.some((point) => this.isVectorIntersecting(point)) }
    isPolyIntersecting (value) { return this.isPolygonIntersecting(value.polygon) }
    isPolygonInside (value) { return value.isIntersecting(this.origin) && value.edgePoints.every((point) => this.isVectorIntersecting(point)) }
    isPolyInside (value) { return this.isPolygonInside(value.polygon) }
    // counts overlapping edge as an intersection
    isIntersecting (value) {
        const bbox = this.getBoundingBox();
        if (value?.isVector && !bbox.isIntersecting(value)) return false;
        else if ((value?.isShape || value?.isPolygon) && !bbox.isIntersecting(value.getBoundingBox())) return false;
        else if (value?.isVector) return this.isVectorIntersecting(value);
        else if (value?.isPath) return this.isPathIntersecting(value);
        else if (value?.isPolygon) return this.isPolygonIntersecting(value);
        else if (value?.isCircle) return this.isCircleIntersecting(value);
        else if (value?.isTriangle) return this.isTriangleIntersecting(value);
        else if (value?.isPoly) return this.isPolyIntersecting(value);
        else throw new Error(`[${this.constructor.name}] Error: Unable to compute intersect of unsupported type ${typeof value}`);
    }
    // Checks if VALUE is inside of THIS
    // counts overlapping edges as still inside
    isInside (value) {
        const bbox = this.getBoundingBox();
        if (value?.isVector && !bbox.isIntersecting(value)) return false;
        else if ((value?.isShape || value?.isPolygon) && !bbox.isIntersecting(value.getBoundingBox())) return false;
        else if (value?.isVector) return this.isVectorIntersecting(value);
        else if (value?.isPath) return this.isPathInside(value);
        else if (value?.isPolygon) return this.isPolygonInside(value);
        else if (value?.isCircle) return this.isCircleInside(value);
        else if (value?.isTriangle) return this.isTriangleInside(value);
        else if (value?.isPoly) return this.isPolyInside(value);
        throw new Error(`[${this.constructor.name}] Error: Unable to check enclosure of unsupported type ${typeof value}`);
    }
    isBordering (value) {
        return this.isIntersecting(value) && !this.isInside(value);
    }
    get isShape () { return true }
    get blob () { return this.#blob }
    get transformation () { return this.#transform }
    get globalTransformation () { return this.#globalTransform }

    // === [ children should overload the following methods ] ===
    Polygon (resolution = 1) { return new Polygon() }
    draw (cursor, close = true) {}
    clone () {}
    // type checks are omitted on the following methods for performance, should be done and routed through isIntersecting or isInside
    isVectorIntersecting (value) { throw new Error() }
    isPathIntersecting (value) { return value.points.some((point) => this.isVectorIntersecting(point)) }
    isCircleIntersecting (value) { return value.isIntersecting(this) }
    isTriangleIntersecting (value) { return value.isIntersecting(this) }
    isPathInside (value) { return value.points.every((point) => this.isVectorIntersecting(point)) }
    isCircleInside (value) { throw new Error() }
    isTriangleInside (value) { throw new Error() }
    get hash () { return this.Polygon(1).hash }
    get origin () { return new Vector() }
    get center () { return new Vector() }
    static fromObject (payload) {
        return Shape.TYPES[payload.data.type].fromObject(payload);
    }
}

export class Circle extends Shape {
    static get TYPE () { return 0 }
    #lastBboxHash;
    constructor (radius = undefined, position = undefined) {
        super();
        this.blob.radii = new Vector(1, 1); // need to support (X, Y) individually
        this.blob.origin = new Vector(0, 0);
        if (radius !== undefined) this.radius = radius;
        if (position?.isVector) this.moveTo(position);
    }
    // localizes point to space such that Circle radii can be considered (1, 1)
    #localizePoint (point, mutate = false) {
        const { radii, origin } = this.blob;
        return point.sub(origin, mutate).div(radii, true);
    }
    #segementIntersecting (start, end, localize = true) {
        // localize to radii scale (so we can treat Circle as uniform radius)
        const localizedPoint = localize ? this.#localizePoint(start) : start;
        const localizedTarget = localize ? this.#localizePoint(end) : end;
        const edge = localizedTarget.sub(localizedPoint);
        const toCenter = localizedPoint.mul(-1);
        const edgeLen = edge.dot(edge);
        let t = edgeLen === 0 ? 0 : toCenter.dot(edge) / edgeLen;
        t = Math.max(0, Math.min(1, t));
        // closest between origin and target to Circle center
        const closest = localizedPoint.add(edge.mul(t));
        return closest.dot(closest) <= 1;
    }
    isVectorIntersecting (value) {
        const { radii, origin } = this.blob;
        return this.#localizePoint(value, false).pow(2).sum() <= 1;
    }
    isPathIntersecting (value) {
        for (let i = 0; i < value.length; i += 2)
            if (this.#segementIntersecting(value.at(i), value.at(i+1), true))
                return true;
        return value.isClosed && this.#segementIntersecting(value.at(-1), value.at(0), true);
    }
    isCircleIntersecting (value) {
        const { radii: radii1, origin: origin1 } = this.blob;
        const { radii: radii2, origin: origin2 } = value.blob;
        
        // draw rough bounding box, check if they're even near each other
        const centerDiff = origin2.sub(origin1);
        const distSq = centerDiff.dot(centerDiff);
        const maxDist = Math.max(radii1.x, radii1.y) + Math.max(radii2.x, radii2.y);
        if (distSq > maxDist * maxDist) return false;
        
        if (!this.isEllipse && !value.isEllipse) {
            // both are uniform circles
            const r1 = radii1.x;
            const r2 = radii2.x;
            const minDistanceSquared = (r2 - r1) * (r2 - r1);
            if (distSq < minDistanceSquared) return true; // one swallows the other
            const maxDistanceSquared = (r2 + r1) * (r2 + r1);
            return distSq <= maxDistanceSquared; // intersection
        }

        const localizedCenter = centerDiff.div(radii1);
        const localizedRadii = radii2.div(radii1);
        const targetDist = localizedCenter.length;
        if (targetDist === 0) return true;

        // closest perimeter point on given Circle to center of this Circle
        const dir = localizedCenter.mul(-1).div(targetDist, true).mul(localizedRadii, true);
        const closest = localizedCenter.add(dir);
        if (closest.pow(2).sum() <= 1
            // one swallowed by the other
            || value.isIntersecting(origin1)) return true;
        return false;
    }
        isTriangleIntersecting (value) {
        const { radii, origin } = this.blob;
        // transform triangle to match scaling on Circle radii- then treat Cricle as uniform radius for rest of calculations
        const o = this.#localizePoint(value.blob.origin);
        const r = this.#localizePoint(value.blob.right);
        const l = this.#localizePoint(value.blob.left);
        // check if legs intersect
        if (this.#segementIntersecting(o, r, false)
            || this.#segementIntersecting(r, l, false)
            || this.#segementIntersecting(l, o, false)) return true;
        // check if triangle is swallowed by circle
        if (o.dot(o) <= 1 && r.dot(r) <= 1 && l.dot(l) <= 1) return true;
        // is circle center in triangle
        return value.isIntersecting(origin);
    }
    isCircleInside (value) {
        const { origin: outerOrigin, radii: outerRadii } = this.blob;
        const { origin: innerOrigin, radii: innerRadii } = value.blob;
        const localizedCenter = this.#localizePoint(innerOrigin);
        const localizedRadii = innerRadii.div(outerRadii);
        const furthest = localizedCenter.add(
            localizedCenter.normalize().mul(localizedRadii, true)
        );
        return furthest.pow(2).sum() <= 1;
    }
    isTriangleInside (value) {
        // [!] WRONG. needs to be redone
        const { origin, right, left } = value.blob;
        return this.isVectorIntersecting(origin)
            && this.isVectorIntersecting(right)
            && this.isVectorIntersecting(left);
    }
    Polygon (resolution = 1) {
        const { origin, radii } = this.blob;
        const path = new Path();
        for (let i = 0; i < 360; i += resolution) {
            const angle = (i * Math.PI) / 180;
            const point = Vector.fromAngle(angle)
                .mul(radii, true)
                .add(origin, true);
            path.push(point);
        }
        return new Polygon(path);
    }
    applyTransformation () {
        const { origin, radii } = this.blob;
        const { offset, scale, rotation } = this.transformation;
        origin.add(offset, true);
        radii.mul(scale, true);
        radii.rotate(rotation, true);
        super.applyTransformation(); // reset transformations
    }
    draw (cursor, close = true) {
        if (this.isEllipse && this.radii.x === 0) return;
        const { origin, right, left } = this.blob;
        const { radii, transformation } = this;
        const precision = this.constructor.DRAW_PRECISION;
        // account for canvas orientation
        transformation.save();
        transformation.reset();
        transformation.angle = Math.PI / 2;
        this.applyTransformation();

        if (close) cursor.beginPath();
        cursor.ellipse(
            origin,
            // canvas can't do negatives, needs to still work even if scale is set to mirror/flip (negative values)
            Math.abs(radii.x).toFixed(precision),
            Math.abs(radii.y).toFixed(precision),
            0,
            0,
            2 * Math.PI
        );
        if (close) cursor.closePath();

        transformation.angle = -Math.PI / 2;
        this.applyTransformation();
        transformation.restore();
    }
    clone () { // does not carry over pending transformations
        const circle = new Circle();
        circle.blob.radii.apply(this.blob.radii);
        circle.blob.origin.apply(this.blob.origin);
        return circle;
    }
    getBoundingBox () {
        const bbox = super.getBoundingBox();
        const { origin, radii } = this.blob;
        const hash = Vector.hashVectors([origin, radii]);
        if (this.#lastBboxHash === hash) return bbox;
        this.#lastBboxHash = hash;
        bbox.min.apply(origin.sub(radii));
        bbox.max.apply(origin.add(radii));
        return bbox;
    }
    get isCircle () { return true }
    get isEllipse () { return !floatEqual(this.blob.radii.modulo(), 0) }
    get radii () { return this.blob.radii }
    set radius (value) { // convenience
        this.transformation.save();
        this.transformation.reset();
        this.blob.radii.apply(value, value);
        this.applyTransformation();
        this.transformation.restore();
        return value;
    }
    get origin () { return this.blob.origin }
    get center () { return this.blob.origin.clone() }
    static fromObject (payload) {
        const { blob, globalTransform } = payload.data;
        const { origin, radii } = blob;
        const circle = new Circle();
        circle.blob.radii.apply(radii.x, radii.y);
        circle.blob.origin.apply(origin.x, origin.y);
        circle.globalTransformation.apply(Transformation.fromObject(globalTransform));
        return circle;
    }
}

// equilateral triangle centered at the topmost point
export class Triangle extends Shape {
    static get TYPE () { return 1 }
    static #LEG_Y = -1 * Math.sqrt(3) / 2;
    static #POINTS = { // [!] never modify
        origin: new Vector(0, 0),
        right: new Vector(.5, Triangle.#LEG_Y),
        left: new Vector(-.5, Triangle.#LEG_Y)
    };
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
    applyTransformation () {
        const { origin, right, left } = this.blob;
        const { offset, scale, rotation } = this.transformation;
        const r = right.sub(origin);
        const l = left.sub(origin);
        // transforms should be relative to origin
        origin.add(offset, true);
        right.apply(origin).add(r.mul(scale, true).rotate(rotation, true), true);
        left.apply(origin).add(l.mul(scale, true).rotate(rotation, true), true);
        super.applyTransformation(); // reset transformations
    }
    draw (cursor, close = true) {
        const { origin, right, left } = this.blob;
        const { transformation } = this;
        const precision = this.constructor.DRAW_PRECISION;
        // account for canvas orientation
        transformation.save();
        transformation.reset();
        transformation.angle = Math.PI / 2;
        this.applyTransformation();

        if (close) cursor.beginPath();
        cursor.moveTo(origin.precision(precision));
        cursor.lineTo(right.precision(precision));
        cursor.lineTo(left.precision(precision));
        if (close) cursor.closePath();

        transformation.angle = -Math.PI / 2;
        this.applyTransformation();
        transformation.restore();
    }
    clone () { // does not carry over pending transformations
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
        const { rotation } = this.transformation;
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
        const { rotation } = this.transformation;
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
    static fromObject (payload) {
        const { blob, globalTransform } = payload.data;
        const { origin, right, left } = blob;
        const triangle = new Triangle();
        triangle.blob.origin.apply(origin.x, origin.y);
        triangle.blob.right.apply(right.x, right.y);
        triangle.blob.left.apply(left.x, left.y);
        triangle.globalTransformation.apply(Transformation.fromObject(globalTransform));
        return triangle;
    }
}

// wraps Polygon, for anything we can't classify as a Circle or Triangle (optimize/workaround for "compound" shapes when computing intersections)
export class Poly extends Shape {
    static get TYPE () { return 2 }
    constructor (polygon = new Polygon()) {
        super();
        this.blob.polygon = polygon;
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
        const data = this.polygon.Float64(this.polygon.depth);
        for (const buffer of data.buffers) decoded.buffers.push(buffer);
        delete data.buffers;
        decoded.data.blob = data;
        return decoded;
    }
    draw (cursor) {
        this.polygon.draw(cursor);
    }
    applyTransformation () {
        // center at (0, 0)
        const offset = this.polygon.center;
        for (const point of this.polygon.path) {
            point.sub(offset, true);
            this.transformation.set(point, true);
            point.add(offset, true);
        }
        super.applyTransformation(); // reset transformations
    }
    clone () { // does not carry over pending transformations
        const poly = new Poly(this.blob.polygon.clone(true));
        return poly;
    }
    getBoundingBox () { return this.polygon.getBoundingBox() }

    get isPoly () { return true }
    get hash () { return this.polygon.hash }
    get origin () { return this.polygon.center }
    get center () { return this.polygon.center }
    get polygon () { return this.blob.polygon }
    static fromObject (payload) {
        const { blob, globalTransform } = payload.data;
        const polygon = Polygon.fromObject(blob, blob.depth);
        const poly = new Poly(polygon);
        poly.globalTransformation.apply(Transformation.fromObject(globalTransform));
        return poly;
    }
}

// Equilateral Polygon 
// unoptimized, can be used to substitute other shapes or support shapes with more sides (Hexagon, Octogon, etc)
// [!] origin is at polygon center, instead of tip
export class Equigon extends Poly {
    static *#generateSides (sides, length) {
        const step = (2 * Math.PI) / sides;
        const radius = length / (2 * Math.sin(Math.PI / sides));
        for (let i = 0; i < sides; i++)
            yield Vector.fromAngle((i * step) + Math.PI / 2)
                .mul(radius, true);
    }
    #sides;
    #length;
    constructor (sides, legLength) {
        const ngon = new Polygon(...Equigon.#generateSides(sides, legLength));
        super(ngon);
        this.#sides = sides;
        this.#length = legLength;
    }

    get isEquigon () { return true }
    get sides () { return this.#sides }
    get length () { return this.#length }
}

Shape.TYPES.push(Circle, Triangle, Poly, Equigon);
Object.freeze(Shape.TYPES);

import { Shape } from "./Shape.js";
import { Vector } from "../math/Vector.js";
import { Path } from "../math/Path.js";
import { Polygon } from "./Polygon.js";
import { equals } from "../math/utils.js";
import { Transform } from "./Transform.js";

export class Circle extends Shape {
    static get TYPE () { return 0 }
    static fromObject (payload) {
        const { blob, globalTransform } = payload;
        const { origin, radii } = blob;
        const circle = new Circle();
        circle.blob.radii.apply(radii.x, radii.y);
        circle.blob.origin.apply(origin.x, origin.y);
        circle.globalTransform.apply(Transform.fromObject(globalTransform));
        return circle;
    }
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
    applyTransform () {
        const { origin, radii } = this.blob;
        const { offset, scale, rotation } = this.transform;
        origin.add(offset, true);
        radii.mul(scale, true);
        radii.rotate(rotation, true);
        super.applyTransform(); // reset transforms
    }
    draw (cursor, close = true) {
        if (this.isEllipse && this.radii.x === 0) return;
        const { origin, right, left } = this.blob;
        const { radii, transform } = this;
        const precision = this.constructor.DRAW_PRECISION;
        // account for canvas orientation
        transform.save();
        transform.reset();
        transform.angle = Math.PI / 2;
        this.applyTransform();

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

        transform.angle = -Math.PI / 2;
        this.applyTransform();
        transform.restore();
    }
    clone () { // does not carry over pending transforms
        const circle = new Circle();
        circle.blob.radii.apply(this.blob.radii);
        circle.blob.origin.apply(this.blob.origin);
        return circle;
    }
    getBoundingBox () {
        const bbox = super.getBoundingBox();
        const { origin, radii } = this.blob;
        const hash = Vector.hash([origin, radii]);
        if (this.#lastBboxHash === hash) return bbox;
        this.#lastBboxHash = hash;
        bbox.min.apply(origin.sub(radii));
        bbox.max.apply(origin.add(radii));
        return bbox;
    }
    get isCircle () { return true }
    get isEllipse () { return !equals(this.blob.radii.modulo(), 0) }
    get radii () { return this.blob.radii }
    set radius (value) { // convenience
        this.transform.save();
        this.transform.reset();
        this.blob.radii.apply(value, value);
        this.applyTransform();
        this.transform.restore();
        return value;
    }
    get origin () { return this.blob.origin }
    get center () { return this.blob.origin.clone() }
}

Shape.TYPES.set(Circle.TYPE, Circle);

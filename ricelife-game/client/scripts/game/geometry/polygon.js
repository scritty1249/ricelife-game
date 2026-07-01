import { Path, BoundingBox, tweenPoints } from "./path.js";
import { Vector } from "./vector.js";
import { TrackableObject } from "../utils/utils.js";

export class Polygon extends TrackableObject { // points should be ordered clockwise (in positioning)
    #path;
    #holes = new Array(); // hole paths must be reordered to counter clockwise positioning
    #bbox = new BoundingBox();
    #edgeHash; // used to check if edge points need to be recomputed
    #edgeSegments = new Array();
    #edgeSegmentPoints = new Array();
    userData = {};
    constructor (...points) {
        super();
        this.#path = (points.length == 1 && points[0]?.isPath)
            ? points[0]
            : new Path(...points);
        this.#path.isClosed = true;
        {
            this.#holes.apply = function (...holes) {
                this.splice(0, this.length);
                for (const hole of holes) {
                    if (!hole.isPolygon) throw new Error(`[${this.constructor.name}] Error: Holes must be Polygons, not ${typeof hole}`);
                    this.push(hole);
                }
            }
        }
    }

    // optimize polygons, remove holes that are completely swallowed / overlapping with other holes
    reduceHoles () {
        const oldHoles = this.holes;
        const newHoles = [];
        for (const hole of oldHoles) {
            if (hole.isIntersecting(this, true)
                && !hole.edgePoints
                    .every((pt) =>
                        oldHoles.some((h) =>
                            !h.eq(hole)
                            && h.isIntersecting(pt)
            ))) newHoles.push(hole);
        }
        oldHoles.splice(0, oldHoles.length);
        for (const hole of newHoles) oldHoles.push(hole);
        return this; // for chaining
    }
    // round off harsh corners
    smooth (maxAngle = Math.PI / 4, mutate = false) {
        const poly = mutate ? this : this.clone(true);
        poly.path.smooth(maxAngle, true);
        return poly; // for chaining
    }
    subsection (resolution = 1) {
        if (resolution === 1) return;
        const path = this.path;
        if (path.points.length <= 1) return;
        const last = path.at(-1);
        path.subsection(resolution);
        // smooth connection between first and last points
        for (const point of tweenPoints(last, path.at(0), resolution))
            path.push(point);
        for (const hole of this.holes)
            hole.subsection(resolution);
    }
    overlap (poly, flatten = false) { // returns an array of Path segments that are overlapping with the given polygon
        if (!poly?.isPolygon) throw new Error(`[${this.constructor.name}] Error: Cannot overlap with non-Polygon type ${typeof poly}`);
        const segments = [];
        let segment = new Path();
        for (const point of this.path.points) {
            if (poly.isIntersecting(point)) segment.push(point);
            else {
                if (segment.length > 0) segments.push(segment);
                segment = new Path();
            }
        }
        if (segment.length > 0) segments.push(segment);
        if (flatten) {
            // return all segments as a conjoined Path
            const segmentsPath = new Path();
            for (const seg of segments)
                segmentsPath.push(...seg);
            return segmentsPath;
        }
        return segments;
    }
    // [!] I have no idea what I'm doing!
    cut (poly, mutate = false) { // https://en.wikipedia.org/wiki/Greiner%E2%80%93Hormann_clipping_algorithm
        if (!poly?.isPolygon) throw new Error(`[${this.constructor.name}] Error: Cannot cut with non-Polygon type ${typeof poly}`);
        const newPolygon = mutate ? this : this.clone();

        // FUCKIN LINKED LISTS?
        const _nodeMap = (p) => ({ pt: p, isIntersect: false, distance: 0, entry: false, visited: false, next: null, prev: null, neighbor: null });
        const _link = (list) => {
            for (let i = 0; i < list.length; i++) {
                list[i].next = list[(i + 1) % list.length];
                list[i].next.prev = list[i];
            }
        };
        const thisPts = this.path.points,
            polyPts = poly.path.points,
            listThis = thisPts.map(_nodeMap),
            listPoly = polyPts.map(_nodeMap);

        // setup neighbors (two way linked list) - (ew)
        _link(listThis);
        _link(listPoly);

        // i dont even remember what the fuck this was for when i wrote it man...
        const intersections = newPolygon.#getIntersections(poly);
        if (intersections.length === 0) {
            if (newPolygon.isIntersecting(polyPts[0])) {
                const hole = poly.clone();
                if (newPolygon.isClockwise) hole.path.points.reverse();
                newPolygon.holes.push(hole);
            }
            return newPolygon;
        }

        // populate node/point details
        for (const inter of intersections) {
            const thisNode = { pt: inter.point, isIntersect: true, distance: inter.coeff.self, entry: inter.entering, visited: false };
            const thatNode = { pt: inter.point, isIntersect: true, distance: inter.coeff.other, entry: !inter.entering, visited: false };

            thisNode.neighbor = thatNode;
            thatNode.neighbor = thisNode;

            let afterThis = listThis[inter.index.self];
            if (!afterThis) afterThis = listThis[0]; // fallback, close LL early
            while (afterThis.next.isIntersect && afterThis.next.distance < inter.coeff.self) afterThis = afterThis.next;
            thisNode.next = afterThis.next; thisNode.prev = afterThis;
            thisNode.next.prev = thisNode; afterThis.next = thisNode;

            let afterThat = listPoly[inter.index.other];
            if (!afterThat) afterThat = listPoly[0]; // fallback
            while (afterThat.next.isIntersect && afterThat.next.distance < inter.coeff.other) afterThat = afterThat.next;
            thatNode.next = afterThat.next; thatNode.prev = afterThat;
            thatNode.next.prev = thatNode; afterThat.next = thatNode;
        }

        // BLACKBOXED LOGIC - WHAT THE HELL IS THIS?
        const polyPieces = [];
        while (true) {
            let currIntersect = null;
            for (let i = 0; i < listThis.length; i++) {
                let node = listThis[i];
                let check = node;
                let firstIter = true;
                const start = check; // sentinal / terminal node
                while (check !== start || firstIter) {
                    firstIter = false;
                    if (check.isIntersect && !check.visited && !check.entry) {
                        currIntersect = check;
                        break;
                    }
                    check = check.next;
                }
                if (currIntersect) break;
            }
            if (!currIntersect) break; 
            const newPts = [];
            let currNode = currIntersect,
                onThis = true;
            while (currNode && !currNode.visited) {
                currNode.visited = true;
                if (currNode.neighbor) currNode.neighbor.visited = true;
                newPts.push(currNode.pt.clone());
                if (currNode.isIntersect) {
                    onThis = !onThis;
                    currNode = currNode.neighbor;
                }
                currNode = currNode.next;
            }
            if (newPts.length > 2)
                polyPieces.push(new Polygon(...newPts));
        }
        if (polyPieces.length > 1) {
            const hole = poly.clone();
            if (newPolygon.path.isClockwise) hole.path.points.reverse();
            newPolygon.holes.push(hole);
        } else if (polyPieces.length !== 0)
            newPolygon.path.apply(...polyPieces[0].path.points);
        return newPolygon.reduceHoles();
    }

    draw (cursor, close = true) { // only draw the path
        if (!this.#path.points.length) return;
        const path = this.path;
        if (close) cursor.beginPath();
        cursor.moveTo(path.points[0]);
        for (let i = 1; i < path.points.length; i++)
            cursor.lineTo(path.points[i]);
        if (close) cursor.closePath();
    }

    isIntersecting (value, ignoreholes = false) {
        if (value?.isVector) {
            // bounding box check, is point even close to this polygon?
            if (!this.getBoundingBox().isIntersecting(value)) return false;
            let inside = false;
            const { x, y } = value;
            const path = this.path;
            const len = path.length;
            for (let i = 0, j = len - 1; i < len; j = i++) {
                const pi = path.points[i];
                const pj = path.points[j];
                const intersect = ((pi.y > y) !== (pj.y > y))
                    && (x < (pj.x - pi.x) * (y - pi.y) / (pj.y - pi.y) + pi.x);
                if (intersect) inside = !inside;
            }
            return inside && (ignoreholes || !this.holes.some((hole) => hole.isIntersecting(value, !ignoreholes)));
        } else if (value?.isPolygon) {
            return value.path.points.some((point) => this.isIntersecting(point));
        } else if (value?.isPath) { // counts surface contact/collision as intersection
            return value.points.some((point) => this.isIntersecting(point));
        } else if (value?.isShape) {
            return value.isIntersecting(this);
        }   
        throw new Error(`[${this.constructor.name}] Error: Unable to compute intersect of unsupported type ${typeof value}`);
    }
    isBordering (value) {
        if (value?.isVector) {
            if (!this.getBoundingBox().isIntersecting(value)) return false;
            for (const edge of this.edges)
                if (edge.isIntersecting(value))
                    return true;
            return false;
        } else if (value?.isPolygon) {
            return value.edges.every((path) => this.isBordering(path) || !this.isIntersecting(path));
        } else if (value?.isPath) {
            return value.points.every((point) => this.isBordering(point) || !this.isIntersecting(point));
        } else if (value?.isShape) {
            return value.isBordering(this);
        }   
        throw new Error(`[${this.constructor.name}] Error: Unable to compute border of unsupported type ${typeof value}`);
    }
    isInside (value) {
        return this.isIntersecting(value) && !this.isBordering(value);
    }
    raycast (ray) {
        const distance = ray.at(0).distance(ray.at(-1));
        const holes = this.holes;
        const hits = [];
        for (const edge of this.edges)
            for (const inter of ray.intersections(edge))
                if (!hits.some(({point}) => // don't record a duplicate hit
                        point.eq(inter.point)))
                    hits.push({
                        // [!] debugging. Values in here are passed by ref and SHOULD NOT be modified
                        _path: edge,
                        _inter: inter,

                        point: inter.point,
                        distance: inter.coeff.self * distance,
                        angle: inter.angle,
                        entering: inter.entering
                    });
        return hits;
    }

    getBoundingBox () {
        const points = this.edgePoints;
        if (!points.length) return new BoundingBox();
        const min = points[0].clone();
        const max = points[0].clone();
        for (const point of points) {
            if (point.x < min.x) min.x = point.x;
            if (point.y < min.y) min.y = point.y;
            if (point.x > max.x) max.x = point.x;
            if (point.y > max.y) max.y = point.y;
        }
        this.#bbox.apply(min, max);
        return this.#bbox;
    }

    nearestTo (point) { // returns the nearest SURFACE point to the given point. Accounts for hole "surfaces"
        const dummy = new Path(this.path.nearestTo(point));
        for (const hole of this.holes)
            dummy.push(hole.nearestTo(point))
        return dummy.nearestTo(point);
    }

    translate (translate, mutate = false) {
        const poly = mutate ? this : this.clone(true);
        poly.path.translate(translate, mutate);
        poly.holes.forEach((hole) => hole.translate(translate, mutate));
        return poly;
    }

    #getIntersections (polygon) { // this will shift the starting point of the Path, but should preserve the order.
        const thisPath = this.path.clone(),
            thatPath = polygon.path.clone();
        // close the paths
        if (thisPath.length > 2) thisPath.push(thisPath.at(-1));
        if (thatPath.length > 2) thatPath.push(thatPath.at(-1));
        return thisPath.intersections(thatPath);
    }

    Float64 (depth = undefined) {
        if (!Number.isInteger(depth) || depth < 0) throw new Error(`[${this.constructor.name}]: Invalid depth ${depth}`);
        const data = {depth};
        data.path = this.path.Float64();
        data.holes = depth > 0 ? this.holes.map((hole) => hole.Float64(depth-1)) : [];
        data.buffers = [data.path.buffer];
        if (this.userData) data.userData = this.userData;
        for (const hole of data.holes.flat(depth))
            data.buffers.push(hole.path.buffer);
        return data;
    }
    get isPolygon () { return true }
    get path () { return this.#path }
    get holes () { return this.#holes }
    get depth () { // [!] can be dangerously expensive
        const holes = this.holes;
        if (!holes.length) return 0;
        return 1 + Math.max(...holes.map(({depth}) => depth));
    }
    get center () { // mostly for debugging
        if (this.path.length === 0) return null;
        const total = this.path.points.reduce((acc, pt) => acc.add(pt, true), new Vector());

        return total.div(this.path.length);
    }
    get hash () {
        // only returns the hash of the points, does not actually count ID
        return Vector.hashVectors(this.path.points.concat(Array.from(
            this.holes, ({path}) => path.points
        ).flat(1)));
    }
    get edges () { // [!] can be expensive
        this.updateEdges();
        return this.#edgeSegments;
    }
    get edgePoints () {
        this.updateEdges();
        return this.#edgeSegmentPoints;
    }
    #computeEdgeSegments () {
        // gather all segments
        const segements = [];
        let segment = new Path();
        // outer edge points
        for (const point of this.path) {
            if (this.holes.some((hole) => hole.isIntersecting(point))) {
                // don't push this point
                if (segment.length) segements.push(segment);
                segment = new Path();
            } else {
                segment.push(point.clone());
            }
        }
        if (segment.length) segements.push(segment);
        // inner (hole) edge points
        segment = new Path();
        for (const hole of this.holes) {
            for (const point of hole.path) {
                if (
                    !this.isIntersecting(point, true) // does the hole path extend beyond the actual Polygon?
                    || this.holes.some((h) => !h.eq(hole) && h.isIntersecting(point)) // is this hole inside of another?
                ) {
                    // don't push this point
                    if (segment.length) segements.push(segment);
                    segment = new Path();
                } else {
                    segment.push(point.clone());
                }
            }
        }
        if (segment.length) segements.push(segment);
        // reconnect segments
        this.#edgeSegments = [];
        const SMOOTHING_TOLERANCE = 1; // merge paths within a tolerance (distance) of N unit gap between ends
        while (segements.length > 0) {
            let current = segements.shift();
            let foundMatch = true;
            while (foundMatch) {
                foundMatch = false;
                for (let i = 0; i < segements.length; i++) {
                    if (current.at(-1).distance(segements[i].at(0)) <= SMOOTHING_TOLERANCE) {
                        for (const pt of segements[i].slice(1)) current.push(pt); 
                        segements.splice(i, 1);
                        foundMatch = true;
                        break;
                    }
                }
            }
            this.#edgeSegments.push(current);
        }
        for (const edge of this.#edgeSegments)
            if (edge.length > 2 && edge.at(-1).distance(edge.at(0)) <= SMOOTHING_TOLERANCE)
                edge.isClosed = true;
        this.#edgeSegmentPoints = this.#edgeSegments
            .map(({points}) => points)
            .flat(1);
    }
    updateEdges () { // check and set
        const edgeHash = this.hash;
        if (this.#edgeHash !== edgeHash) {
            this.#edgeHash = edgeHash;
            this.#computeEdgeSegments();
            return true;
        }
        return false;
    }
    edgeNodes (ignoreHoles = false) {
        const nodes = this.path.pointNodes;
        for (const hole of this.holes)
            nodes.push(...hole.edgeNodes(ignoreHoles)
                .filter(({point})=>
                    ignoreHoles
                    || !this.holes.some((h)=>h.isIntersecting(point)))
                .map((pt) => ({...pt, hole: true})));
        return nodes;
    }
    roundPoints (precision) {
        this.path.round(precision);
        for (const hole of this.holes)
            hole.roundPoints(precision);
        return this; // for chaining
    }
    apply (polygon) {
        if (!polygon?.isPolygon) throw new Error(`[${this.constructor.name}] Error: Cannot apply non-Polygon type ${typeof polygon}`);
        this.#path.apply(polygon.path);
        this.#holes.apply(...polygon.holes);
        return this; // for chaining
    }
    toString () {
        return `[Polygon] <{ ${this.path.toString()}, Holes: [${ // [!] RECURSION RISK
            Array.from(this.holes, (hole) => hole.toString()).join(", ")
        }] }>`;
    }
    clone (deep = false) {
        const poly = new Polygon(this.path.clone(deep));
        poly.holes.apply(...this.holes.map(hole => hole.clone(deep)));
        poly.userData = deep ? structuredClone(this.userData) : this.userData;
        return poly;
    }
    static fromObject (data, depth) {
        const polygon = new Polygon(Path.fromArray(data.path));
        if (data.userData) polygon.userData = data.userData;
        if (depth)
            for (const hole of data.holes) {
                const poly = this.fromObject(hole, depth-1);
                if (poly.path.isClockwise) poly.path.points.reverse();
                polygon.holes.push(poly);
            }
        return polygon;
    }
}

// basically a bounding box that defines all four corner points (supports rotations)
// supposed to be lightweight
export class Hitbox {
    #edges = new Path(
        new Vector(),
        new Vector(),
        new Vector(),
        new Vector(),
    );
    constructor (topLeft, topRight, bottomRight, bottomLeft) {
        this.#edges.isClosed = true;
        this.#edges.at(0).apply(topLeft);
        this.#edges.at(1).apply(topRight);
        this.#edges.at(2).apply(bottomRight);
        this.#edges.at(3).apply(bottomLeft);
    }
    #isShapeIntersecting (shape) {
        return shape.isIntersecting(this.edges);
    }
    #isHitboxIntersecting (hitbox) {
        return this.edges.points.some((pt) => hitbox.isIntersecting(pt))
            || hitbox.edges.points.some((pt) => this.#isPointIntersecting(pt));
    }
    #isPointIntersecting (point) {    
        const [tl, tr, br, bl] = this.edges.points;
        const cross1 = tr.sub(tl).cross(point.sub(tl));
        const cross2 = br.sub(tr).cross(point.sub(tr));
        const cross3 = bl.sub(br).cross(point.sub(br));
        const cross4 = tl.sub(bl).cross(point.sub(bl));
        return (cross1 >= 0 && cross2 >= 0 && cross3 >= 0 && cross4 >= 0)
            || (cross1 <= 0 && cross2 <= 0 && cross3 <= 0 && cross4 <= 0);
    }
    #isBoundingBoxIntersecting (bbox) {
        return this.#isPointIntersecting(bbox.min)
            || this.#isPointIntersecting(bbox.max)
            || this.edges.points.some((pt) => bbox.isIntersecting(pt));
    }
    isIntersecting (value) {
        if (value?.isVector) {
            return this.#isPointIntersecting(value);
        } else if (value?.isHitbox) {
            return this.#isHitboxIntersecting(value);
        } else if (value?.isBoundingBox) {
            return this.#isBoundingBoxIntersecting(value);
        } else if (value?.isShape) {
            return this.#isShapeIntersecting(value);
        } else return false; // dont throw errors on unknown types
    }
    draw (cursor, close = true) {
        if (close) cursor.beginPath();
        cursor.moveTo(this.topLeft);
        cursor.lineTo(this.topRight);
        cursor.lineTo(this.bottomRight);
        cursor.lineTo(this.bottomLeft);
        if (close) cursor.closePath();
    }
    Polygon () { return new Polygon(this.edges.clone(true)) }
    get isHitbox () { return true }
    get edges () { return this.#edges }
    get topLeft () { return this.#edges.at(0) }
    get topRight () { return this.#edges.at(1) }
    get bottomRight () { return this.#edges.at(2) }
    get bottomLeft () { return this.#edges.at(3) }
    get center () { return Vector.average(this.#edges.points) }
}

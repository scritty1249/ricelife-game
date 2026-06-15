import { Path, tweenPoints } from "./path.js";
import { Vector } from "./vector.js";
import { TrackableObject } from "../utils/utils.js";

export class Polygon extends TrackableObject { // points should be ordered clockwise (in positioning)
    #path;
    #holes;
    constructor (...points) {
        super();
        this.#holes = []; // hole paths must be reordered to counter clockwise positioning
        this.#holes.apply = function (...holes) {
            this.splice(0, this.length);
            for (const hole of holes) {
                if (!hole.isPolygon) throw new Error(`[${this.constructor.name}] Error: Holes must be Polygons, not ${typeof hole}`);
                this.push(hole);
            }
        }
        this.#path = (points.length == 1 && points[0]?.isPath)
            ? points[0]
            : new Path(...points);
    }

    smooth (resolution = 1) {
        const path = this.path;
        if (path.points.length == 1) return;
        const last = path.at(-1);
        path.smooth(resolution);
        // smooth connection between first and last points
        for (const point of tweenPoints(last, path.at(0), resolution))
            path.push(point);
        for (const hole of this.holes)
            hole.smooth(resolution);
    }

    overlap (poly) { // returns an array of Path segments that are overlapping with the given polygon
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
        return newPolygon;
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
        } else
            throw new Error(`[${this.constructor.name}] Error: Unable to compute intersect of unsupported type ${typeof value}`);
    }

    raycast (ray) {
        const distance = ray.at(0).distance(ray.at(-1));
        const holes = this.holes;
        const hits = [];
        for (const inter of ray.intersections(this.path))
            if (!holes.some(hole => hole.isIntersecting(inter.point)) && !hits.some(({point}) => point.eq(inter.point)))
                hits.push({ point: inter.point, distance: inter.coeff.other * distance, angle: inter.angle, entering: inter.entering });
        for (let idx = 0; idx < holes.length; idx++) {
            holes[idx].raycast(ray).filter((hit) => {
                hit.entering = !hit.entering;
                return !holes.some((h, i) => i == idx || h.isIntersecting(hit.point));
            });
        }
        for (const hole of holes) {
            hole.raycast(ray).filter((hit) => {
                hit.entering = !hit.entering;
                return !holes.some((h) => h.isIntersecting(hit.point));
            });
        }
        return hits;
    }

    nearestTo (point) { // returns the nearest SURFACE point to the given point. Accounts for hole "surfaces"
        const dummy = new Path(this.path.nearestTo(point));
        for (const hole of this.holes)
            dummy.push(hole.nearestTo(point))
        return dummy.nearestTo(point);
    }

    translate (translate, mutate = false) {
        const poly = mutate ? this : this.clone();
        poly.path.translate(translate, mutate);
        poly.holes.forEach((hole) => hole.translate(translate, mutuate));
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

    Float64 (depth, buffer = true) {
        const data = {depth};
        data.path = this.path.Float64();
        data.holes = depth > 0 ? this.holes.map((hole) => hole.Float64(depth-1, false)) : [];
        if (buffer) {
            data.buffers = [data.path.buffer];
            for (const hole of data.holes.flat(depth))
                data.buffers.push(hole.path.buffer);
        }
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
    edgePoints () { // returns out of order points from polygon and holes that do not overlap with any other holes
        const points = [...this.path.points];
        for (const hole of this.holes)
            points.push(...hole.path.points
                .filter(({point})=>
                    !this.holes.some((h)=>h.isIntersecting(point))));
        return points;
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
        return poly;
    }
    static fromObject (data, depth) {
        const polygon = new Polygon(Path.fromArray(data.path));
        if (depth)
            for (const hole of data.holes) {
                const poly = this.fromObject(hole, depth-1);
                if (poly.path.isClockwise) poly.path.points.reverse();
                polygon.holes.push(poly);
            }
        return polygon;
    }
}


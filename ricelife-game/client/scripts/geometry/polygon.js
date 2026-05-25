import { Path, tweenPoints } from "./path.js";
import { TrackableObject } from "../utils.js";

export class Polygon extends TrackableObject { // points should be ordered clockwise (in positioning)
    #path;
    #holes
    constructor (...points) {
        super();
        this.#holes = []; // hole paths must be reordered to counter clockwise positioning
        this.#holes.apply = function (...holes) {
            this.splice(0, this.length);
            for (const hole of holes) {
                if (!hole.isPolygon) throw new Error("[Polygon] Error: Holes must be Polygons, not " + (typeof hole));
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

    merge (poly, mutate = false) {

    }

    // [!] I have no idea what I'm doing!
    cut (poly, mutate = false) { // https://en.wikipedia.org/wiki/Greiner%E2%80%93Hormann_clipping_algorithm
        if (!poly?.isPolygon) {
            throw new Error("[Polygon] Error: Cannot cut with non-Polygon type " + (typeof poly));
        }
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
                    currNode = (currNode.entry !== onThis) ? currNode.prev : currNode.next;
                } else
                    currNode = onThis ? currNode.next : currNode.prev;
            }
            if (newPts.length > 2)
                polyPieces.push(new Polygon(new Path(...newPts)));
        }
        if (polyPieces.length === 0) return newPolygon;
        if (polyPieces.length > 1) {
            const hole = poly.clone();
            if (newPolygon.path.isClockwise) hole.path.points.reverse();
            newPolygon.holes.push(hole);
        } else
            newPolygon.path.apply(...polyPieces[0].path.points);
        return newPolygon;
    }

    draw (ctx, close = true) { // only draw the path
        if (!this.#path.points.length) return;
        const path = this.path;
        if (close) ctx.beginPath();
        ctx.moveTo(...path.points[0]);
        for (let i = 1; i < path.points.length; i++)
            ctx.lineTo(...path.points[i]);
        if (close) ctx.closePath();
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
            return inside && (ignoreholes || !this.holes.some((hole) => hole.isIntersecting(value)));
        } else if (value?.isPolygon) {
            return value.path.points.some((point) => this.isIntersecting(point));
        } else if (value?.isPath) { // counts surface contact/collision as intersection
            return value.points.some((point) => this.isIntersecting(point));
        } else
            throw new Error("[Polygon] Error: Unable to compute intersect of unsupported type " + (typeof value));
    }

    raycast (origin, direction, distance) {
        const ray = new Path(origin, origin.add(direction.mul(distance)));
        const hits = [];
        const outerIntersects = ray.intersect(this.path);
        for (const inter of outerIntersects)
            if (!this.holes.some(hole => hole.isIntersecting(inter.point)) && !hits.some(({point}) => point.eq(inter.point)))
                hits.push({ point: inter.point, distance: inter.coeff.other * distance, angle: inter.angle, entering: inter.entering });
        for (const hole of this.holes) {
            const holeIntersects = ray.intersect(hole.path);
            for (const inter of holeIntersects)
                if (this.isIntersecting(inter.point, true) && !hits.some(({point}) => point.eq(inter.point)))
                    hits.push({ point: inter.point, distance: inter.coeff.other * distance, angle: (inter.angle + Math.PI) % (2 * Math.PI), entering: !inter.entering});
        }
        return hits;
    }

    translate (translate, mutate = false) {
        const poly = mutate ? this : this.clone();
        for (const pt of poly.path.points)
            pt.add(translate, true);
        return poly;
    }

    #getIntersections (polygon) { // this will shift the starting point of the Path, but should preserve the order.
        const thisPath = this.path.clone(),
            thatPath = polygon.path.clone();
        // close the paths
        if (thisPath.length > 2) thisPath.push(thisPath.at(-1));
        if (thatPath.length > 2) thatPath.push(thatPath.at(-1));
        return thisPath.intersect(thatPath);
    }

    Float64 (depth, buffer = true) {
        const data = {};
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

    apply (polygon) {
        if (!polygon?.isPolygon) throw new Error("[Polygon] Error: Cannot apply non-Polygon type " + (typeof polygon));
        this.#path.apply(polygon.path);
        this.#holes.apply(...polygon.holes);
        return this; // for chaining
    }
    toString () {
        return `[Polygon] <{ ${this.path.toString()}, Holes: [${ // [!] RECURSION RISK
            Array.from(this.holes, (hole) => hole.toString()).join(", ")
        }] }>`;
    }
    clone () {
        const poly = new Polygon(this.path.clone());
        poly.holes.apply(...this.holes.map(hole => hole.clone()));
        return poly;
    }
    static fromObject (data, depth) {        
        const polygon = new Polygon(Path.fromArray(data.path));
        if (depth)
            for (const hole of data.holes)
                polygon.holes.push(this.fromObject(hole, depth-1));
        return polygon;
    }
}


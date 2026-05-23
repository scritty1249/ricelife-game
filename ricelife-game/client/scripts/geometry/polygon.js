import { Path, tweenPoints } from "./path.js";
import { TrackableObject } from "../utils.js";

export class Polygon extends TrackableObject { // points should be ordered clockwise (in positioning)
    #path;
    constructor (...points) {
        super();
        this.holes = []; // hole paths must be reordered to counter clockwise positioning
        this.#path = (points.length == 1 && points[0]?.isPath)
            ? points[0]
            : new Path(...points);
    }

    smooth (resolution = 1) {
        if (this.#path.points.length == 1) return;
        const last = this.#path.at(-1);
        this.#path.smooth(resolution);
        // smooth connection between first and last points
        for (const point of tweenPoints(last, this.#path.at(0), resolution))
            this.#path.push(point);
        for (const hole of this.holes)
            hole.smooth(resolution);
    }

    // [!] do we even need this?
    // merge (poly, mutate = false) {
    //     const polygon = mutate ? this : this.clone();
    //     const intersects = this.#getIntersections(poly);
    //     if (!intersects.length) return;
    // }

    // [!] I have no idea what I'm doing!
    cut (poly, mutate = false) { // https://en.wikipedia.org/wiki/Greiner%E2%80%93Hormann_clipping_algorithm
        if (!poly?.isPolygon) {
            throw new Error("[Polygon] Error: Cannot cut with non-Polygon type " + (typeof poly));
        }
        const newPolygon = mutate ? this : this.clone();

        // FUCKIN LINKED LISTS?
        const _nodeMap = (p) => ({ pt: p, isIntersect: false, alpha: 0, entry: false, visited: false, next: null, prev: null, neighbor: null });
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

        const intersections = this.#getIntersections(poly);
        if (intersections.length === 0) {
            if (this.isIntersecting(polyPts[0])) {
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
            while (afterThis.next.distance !== 0 && afterThis.next.distance < inter.coeff.self) afterThis = afterThis.next;
            thisNode.next = afterThis.next; thisNode.prev = afterThis;
            thisNode.next.prev = thisNode; afterThis.next = thisNode;

            let afterThat = listPoly[inter.index.other];
            if (!afterThat) afterThat = listPoly[0]; // fallback
            while (afterThat.next.distance !== 0 && afterThat.next.distance < inter.coeff.other) afterThat = afterThat.next;
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
            if (newPolygon.isClockwise) hole.path.points.reverse();
            newPolygon.holes.push(hole);
        } else
            newPolygon.path.apply(...polyPieces[0].path.points);
        return newPolygon;
    }

    draw (ctx, close = true) { // only draw the path
        if (!this.#path.points.length) return;
        if (close) ctx.beginPath();
        ctx.moveTo(...this.#path.points[0]);
        for (let i = 1; i < this.#path.points.length; i++)
            ctx.lineTo(...this.#path.points[i]);
        if (close) ctx.closePath();
    }

    isIntersecting (value, ignoreholes = false) {
        if (value?.isVector) {
            let inside = false;
            const { x, y } = value;
            const len = this.#path.length;
            for (let i = 0, j = len - 1; i < len; j = i++) {
                const pi = this.#path.points[i];
                const pj = this.#path.points[j];
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
        // if (ascending)
        //     hits.sort((a, b) => a.d - b.d);
        // else
        //     hits.sort((a, b) => b.d - a.d);
        return hits;
    }

    #getIntersections (polygon) { // this will shift the starting point of the Path, but should preserve the order.
        const thisPath = this.path.clone(),
            thatPath = polygon.path.clone();
        // close the paths
        if (thisPath.length > 2) thisPath.push(thisPath.at(-1));
        if (thatPath.length > 2) thatPath.push(thatPath.at(-1));
        return thisPath.intersect(thatPath);
    }

    get isPolygon () { return true }
    get path () { return this.#path }
    
    toString () {
        return `[Polygon] {${
            Array.from([...this.#path], (pt) => pt.toString()).join(", ")
        }}`;
    }
    clone () {
        const poly = new Polygon(this.#path.clone());
        poly.holes = this.holes.map(hole => hole.clone());
        return poly;
    }
}


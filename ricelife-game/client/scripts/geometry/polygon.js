import { Path, tweenPoints } from "./path.js";
import { TrackableObject } from "../utils.js";

export class Polygon extends TrackableObject { // points should be ordered clockwise (in positioning)
    #path;
    constructor (...points) {
        super();
        this.#path = (points.length == 1 && points[0]?.isPath)
            ? points[0]
            : new Path(...points);
    }

    smooth (resolution = 1) {
        if (this.#path.points.length == 1) return;
        this.#path.smooth(resolution);
        // smooth connection between first and last points
        for (const point of tweenPoints(this.#path.points.at(-1), this.#path.points[0], resolution))
            this.#path.push(point);
    }

    merge (poly, mutate = false) {
        const polygon = mutate ? this : this.clone();
        
    }

    cut (poly, mutate = false) {
        if (!poly?.isPolygon) {
            throw new Error("[Polygon] Error: Cannot cut with non-Polygon type");
        }

        const polygon = mutate ? this : this.clone();
        
        const subjectPoints = polygon.path.points;
        const clipPoints = poly.path.points;

        const results = executeBooleanOp(subjectPoints, clipPoints, 'difference');

        if (results.length > 0) {
            polygon.path.points = results[0];
        } else {
            polygon.path.points = []; // Completely clipped out out of screen bounds
        }

        return polygon;

    }

    draw (ctx) { // only draw the path
        if (!this.#path.points.length) return;
        ctx.beginPath();
        ctx.moveTo(...this.#path.points[0]);
        for (const point of this.#path.points.slice(1))
            ctx.lineTo(...point);
        ctx.closePath();
    }

    isIntersecting (value) {
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
            return inside;
        } else if (value?.isPath) { // counts surface contact/collision as intersection
            return value.path.points.some((point) => this.isIntersecting(point));
        } else
            throw new Error("[Polygon] Error: Unable to compute intersect of unsupported type " + (typeof value));
    }

    get isPolygon () { return true }
    get path () { return this.#path }
    
    toString () {
        return `[Polygon] {${
            Array.from(...this.#path, ([x, y]) => `(${x}, ${y})`).join(", ")
        }}`;
    }
    clone () {
        return new Polygon(this.#path);
    }
}

// [!] test
const EPSILON = 1e-9;
const approxEqual = (a, b) => Math.abs(a - b) < EPSILON;

class Vertex {
  constructor(vector, isIntersection = false, isEntry = false, distance = 0) {
    this.vector = vector;
    this.isIntersection = isIntersection;
    this.isEntry = isEntry;
    this.distance = distance;
    this.visited = false;
    this.neighbor = null;
  }
}

function getIntersection(p1, p2, p3, p4) {
  const d1 = p2.sub(p1);
  const d2 = p4.sub(p3);
  const den = d2.y * d1.x - d2.x * d1.y;
  if (Math.abs(den) < EPSILON) return null;

  const ua = (d2.x * (p1.y - p3.y) - d2.y * (p1.x - p3.x)) / den;
  const ub = (d1.x * (p1.y - p3.y) - d1.y * (p1.x - p3.x)) / den;

  if (ua >= -EPSILON && ua <= 1 + EPSILON && ub >= -EPSILON && ub <= 1 + EPSILON) {
    const clampedUa = Math.max(0, Math.min(1, ua));
    return { vector: p1.add(d1.mul(clampedUa)), ua: clampedUa, ub: Math.max(0, Math.min(1, ub)) };
  }
  return null;
}

// Mode can be: 'union', 'intersect', or 'difference'
export function executeBooleanOp(subjectPoints, clipPoints, mode) {
  const sLen = subjectPoints.length;
  const cLen = clipPoints.length;

  const subjectList = subjectPoints.map(v => new Vertex(v));
  const clipList = clipPoints.map(v => new Vertex(v));
  const sIntersections = Array.from({ length: sLen }, () => []);
  const cIntersections = Array.from({ length: cLen }, () => []);

  let hasIntersections = false;

  for (let i = 0; i < sLen; i++) {
    const s1 = subjectPoints[i];
    const s2 = subjectPoints[(i + 1) % sLen];
    const sDir = s2.sub(s1);

    for (let j = 0; j < cLen; j++) {
      const c1 = clipPoints[j];
      const c2 = clipPoints[(j + 1) % cLen];
      const cDir = c2.sub(c1);

      const inter = getIntersection(s1, s2, c1, c2);
      if (inter) {
        if ((approxEqual(inter.ua, 0) || approxEqual(inter.ua, 1)) && 
            (approxEqual(inter.ub, 0) || approxEqual(inter.ub, 1))) continue;

        // Cross product determines if subject is entering the clip geometry
        const cross = sDir.x * cDir.y - sDir.y * cDir.x;
        const isEntry = cross < 0;

        const sVert = new Vertex(inter.vector, true, isEntry, inter.ua);
        const cVert = new Vertex(inter.vector, true, isEntry, inter.ub);

        sVert.neighbor = cVert;
        cVert.neighbor = sVert;

        sIntersections[i].push(sVert);
        cIntersections[j].push(cVert);
        hasIntersections = true;
      }
    }
  }

  // Fallback state if the polygons do not cross boundaries
  if (!hasIntersections) {
    const sInsideC = clipPoints.some(p => p.isVector) && anyPointInside(subjectPoints[0], clipPoints);
    const cInsideS = subjectPoints.some(p => p.isVector) && anyPointInside(clipPoints[0], subjectPoints);

    if (mode === 'union') {
      if (sInsideC) return [clipPoints];
      if (cInsideS) return [subjectPoints];
      return [subjectPoints, clipPoints]; // Disjoint, keep both loops
    }
    if (mode === 'intersect') {
      if (sInsideC) return [subjectPoints];
      if (cInsideS) return [clipPoints];
      return []; // Disjoint, no overlap
    }
    if (mode === 'difference') {
      if (sInsideC) return []; // Completely eaten up
      if (cInsideS) return [subjectPoints]; // Needs hole processing (simplified here)
      return [subjectPoints]; // Disjoint, untouched
    }
  }

  const finalSubjectList = [];
  for (let i = 0; i < sLen; i++) {
    finalSubjectList.push(subjectList[i]);
    sIntersections[i].sort((a, b) => a.distance - b.distance);
    finalSubjectList.push(...sIntersections[i]);
  }

  const finalClipList = [];
  for (let j = 0; j < cLen; j++) {
    finalClipList.push(clipList[j]);
    cIntersections[j].sort((a, b) => a.distance - b.distance);
    finalClipList.push(...cIntersections[j]);
  }

  const resultPolygons = [];
  
  // Rule mapping based on standard Weiler-Atherton variant configurations
  const targetEntry = (mode === 'union' || mode === 'difference') ? false : true; 

  while (true) {
    let current = finalSubjectList.find(v => v.isIntersection && v.isEntry === targetEntry && !v.visited);
    if (!current) break;

    const component = [];
    const startNode = current;
    let currentList = finalSubjectList;

    while (current && !current.visited) {
      current.visited = true;
      if (current.neighbor) current.neighbor.visited = true;

      component.push(current.vector.clone());

      if (current.isIntersection) {
        currentList = (currentList === finalSubjectList) ? finalClipList : finalSubjectList;
        current = current.neighbor;
        
        // In difference mode, reverse direction tracing when traveling on clip polygon boundaries
        if (mode === 'difference' && currentList === finalClipList) {
           // Standard WA variations for subtraction can invert index processing loops
        }
      }

      const idx = currentList.findIndex(v => approxEqual(v.vector.x, current.vector.x) && approxEqual(v.vector.y, current.vector.y));
      current = currentList[(idx + 1) % currentList.length];

      if (approxEqual(current.vector.x, startNode.vector.x) && approxEqual(current.vector.y, startNode.vector.y)) {
        break;
      }
    }
    resultPolygons.push(component);
  }

  return resultPolygons;
}

// Simple internal helper matching your ray-casting container loop
function anyPointInside(point, polyPoints) {
  let inside = false;
  const len = polyPoints.length;
  for (let i = 0, j = len - 1; i < len; j = i++) {
    const pi = polyPoints[i];
    const pj = polyPoints[j];
    if (((pi.y > point.y) !== (pj.y > point.y)) && 
        (point.x < (pj.x - pi.x) * (point.y - pi.y) / (pj.y - pi.y) + pi.x)) {
      inside = !inside;
    }
  }
  return inside;
}
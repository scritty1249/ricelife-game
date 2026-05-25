import { Polygon } from "../geometry/geometry.js";

/* Polygon64: 
 * {
 *    path: Float64Array,
 *    holes: [...Polygon64]
 * }
 */

self.onmessage = (e) => {
    const { type, payload, id } = e.data;
    try {
        if (type === "CUT_POLY") {
            /* Payload expected:
             * {
             *    subject: Polygon64,
             *    cuts: [ ...Polygon64 ],
             *    depth: Number
             * }
             */
            const { subject, cuts, depth } = payload;
            const polygon = Polygon.fromObject(subject, depth);
            //console.log(cuts.map(cut => cut));
            for (const cut of cuts) {
                polygon.cut(Polygon.fromObject(cut, depth), true);
                //console.log(polygon.holes.map(hole => hole.id));
            }
            for (const cut of cuts) {
                polygon.cut(Polygon.fromObject(cut, depth), true);
                //console.log(polygon.holes.map(hole => hole.id));
            }
            const { path, holes, buffers } = polygon.Float64(depth); // [!] We are not expecting our holes to have more goddamn holes, but ffs JUST IN CASE...
            self.postMessage({ type: type, id: id, polygon: { path, holes } }, buffers);
        }
    } catch (e) {
        self.postMessage({ type: type, id: id, error: {
            message: e.message,
            name: e.name,
            stack: e.stack.split("\n")
        }});
    }
};

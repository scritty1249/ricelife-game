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
             *    cuts: [ ...Polygon64 ]
             * }
             */
            const { subject, cuts } = payload;
            const polygon = Polygon.fromArray(subject.path, ...subject.holes.map((hole) => Polygon.fromArray(hole)));
            for (const { path, holes } of cuts)
                polygon.cut(
                    Polygon.fromArray(path, ...holes.map((hole) => Polygon.fromArray(hole))),
                    true
                );
            const { path, holes } = polygon.Float64; // [!] maximum depth of 2. We are not expecting our holes to have more goddamn holes
            self.postMessage({ type: type, id: id, polygon: { path, holes } }, [path.buffer, ...holes.map((hole) => hole.buffer)]);
        }
    } catch (e) {
        self.postMessage({ type: type, id: id, error: {
            message: e.message,
            name: e.name,
            stack: e.stack.split("\n")
        }});
    }
};

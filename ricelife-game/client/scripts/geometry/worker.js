import { Polygon } from "./polygon.js";
export class GeometryWorker {
    worker;
    #maxDepth;
    constructor (maxHoleDepth = 5) {
        this.#maxDepth = maxHoleDepth;
    }

    async cut (subject, ...cuts) {
        if (!subject.isPolygon || cuts.some((cut) => !cut.isPolygon)) throw new Error(`[${this.constructor.name}] Error: non-Polygon passed to Polygon-only operation`);
        const payload = { callback: true, subject: subject.Float64(this.#maxDepth), cuts: []};
        const transfer = payload.subject.buffers;
        for (const cut of cuts) {
            const data = cut.Float64(this.#maxDepth);
            payload.cuts.push(data);
            transfer.push(...data.buffers);
        }
        // don't bother caching
        const { payload: data } = await this.worker.post("CUTPOLY", payload, transfer);
        console.log(data);
        return Polygon.fromObject(data.polygon, this.#maxDepth);
    }

}
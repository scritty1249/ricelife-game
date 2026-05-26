import { WorkerManager } from "../controller/controller.js";
import { Polygon } from "./polygon.js";
export class GeometryWorker {
    #worker;
    #maxDepth;
    constructor (maxHoleDepth = 5) {
        this.#worker = new WorkerManager("./scripts/workers/geometry-worker.js");
        this.#maxDepth = maxHoleDepth;
    }

    async cut (key, subject, ...cuts) {
        if (!subject.isPolygon || cuts.some((cut) => !cut.isPolygon)) throw new Error("[GeometryWorker] Error: non-Polygon passed to Polygon-only operation");
        const subjectData = subject.Float64(this.#maxDepth);
        const payload = { subject: {path: subjectData.path, holes: subjectData.holes}, depth: this.#maxDepth, cuts: []};
        const transfer = subjectData.buffers;
        for (const cut of cuts) {
            const data = cut.Float64(this.#maxDepth);
            payload.cuts.push({ path: data.path, holes: data.holes });
            transfer.push(...data.buffers);
        }
        return this.worker.post("CUT_POLY", payload, transfer, key, ["polygon"])
            .then(({polygon}) => Polygon.fromObject(this.worker.cache[key]?.polygon ? this.worker.cache[key].polygon : polygon, this.#maxDepth));
    }

    get worker () { return this.#worker }
}
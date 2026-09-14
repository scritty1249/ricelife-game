import { Color } from "../math/Color.js";
import { typeString } from "../utils/logging.js";

// bundle tracer to be seperated from Ammos
export class AmmoTracer {
    #multishots = new Array(); // 2D array, contains sequence of MultShotStage tracers (Paths)
    #color = new Color(255, 255, 255, .35);
    lineDash = new Array(10, 20);
    constructor (multishots) {
        for (const multishot of multishots) {
            if (!multishot?.isMultishot) throw new Error(`[${typeString(this)}]: Invalid parameter array item, expected Multishot, got ${typeString(multishot)}`);
            this.#multishots.push(multishot.tracer); // multishot.tracer should be an Array of Paths
        }
    }

    draw (cursor) {
        cursor.save();
        cursor.setLineDash(this.lineDash);
        cursor.strokeStyle = this.color.toString();
        for (const traces of this.#multishots)
            for (const trace of traces)
                trace.draw(cursor, true);
        cursor.restore();
    }

    get isAmmoTracer () { return true }
    get color () { return this.#color }
}

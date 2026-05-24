import { Polygon, Color } from "../geometry/geometry.js";
import { drawTerrain } from "../terrain/terrain.js";
import { wipeCanvas } from "../controller/display.js";

const CANVAS = {};

self.onmessage = (e) => {
    const { type, payload, id } = e.data;
    try {
        if (type === "INIT_CANVAS") {
            /* Payload expected:
             * {
             *    width: Number,
             *    height: Number,
             *    key: String
             * }
             */
            const { width, height, key } = payload;
            CANVAS[key] = initCanvas(width, height);
            self.postMessage({ type: type, id: id });
        } else if (type === "DRAW_TERRAIN") {
            /* Payload expected:
             * {
             *    key: String,
             *    path: Float64Array,
             *    holes: [...Float64Array],
             *    edgeColor: String,
             *    fillColor: String,
             *    gradientWidth: Number,
             *    resolution: Number
             * }
             */
            const { key, path, holes, edgeColor, fillColor, gradientWidth, resolution } = payload;
            const { canvas, ctx } = CANVAS[key];
            const terrain = Polygon.fromArray(path, ...holes);
            CANVAS[key].clear();
            drawTerrain(ctx, terrain, new Color(fillColor), new Color(edgeColor), gradientWidth, resolution);
            const bitmap = canvas.transferToImageBitmap();
            self.postMessage({ type: type, id: id, image: bitmap }, [bitmap]);
        } else if (type === "DRAW_IMAGE") {
            /* Payload expected:
             * {
             *    key: String,
             *    image: Bitmap,
             *    x: Number,
             *    y: Number,
             *    width?: Number,
             *    height?: Number
             * }
             */
            const { key, image, x, y, width, height } = payload;
            const { canvas, ctx } = CANVAS[key];
            if (width === undefined || height === undefined) ctx.drawImage(image, x, y);
            else ctx.drawImage(image, x, y, width, height);
            const bitmap = canvas.transferToImageBitmap();
            self.postMessage({ type: type, id: id, image: bitmap }, [bitmap]);
        } else if (type === "CLEAR_CANVAS") {
            /* Payload expected:
             * {
             *    key: String
             * }
             */
            const { key } = payload;
            CANVAS[key].clear();
            self.postMessage({ type: type, id: id, key: key });
        } else if (type === "DROP_CANVAS") {
            /* Payload expected:
             * {
             *    key: String
             * }
             */
           const { key } = payload;
           delete CANVAS[key];
           self.postMessage({ type: type, id: id, key: key });
        }
    } catch (e) {
        self.postMessage({ type: type, id: id, error: {
            message: e.message,
            name: e.name,
            stack: e.stack.split("\n")
        }});
    }
};

function initCanvas (width, height) {
    const canvas = new OffscreenCanvas(width, height)
    return {
        canvas: canvas,
        ctx: canvas.getContext("2d"),
        clear: wipeCanvas
    };
}

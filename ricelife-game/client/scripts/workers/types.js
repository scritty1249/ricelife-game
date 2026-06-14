import { Canvas2DContextCursorFactory } from "../controller/controller.js";
import { Polygon } from "../geometry/geometry.js";

export const CACHE_TYPES = {
    POLY: {
        create (path, holes, depth) {
            return this.encode({path, holes, depth});
        },
        decode: (data, ref = false) => {
            const { depth } = data;
            const { path, holes, buffers } = data.poly.Float64(depth); // [!] We are not expecting our holes to have more goddamn holes, but ffs JUST IN CASE...
            const reference = { depth };
            return {
                buffers, reference,
                payload: { path, holes, depth },
            };
        },
        encode: (payload, peer = true) => {
            const poly = payload?.isPolygon ? payload : Polygon.fromObject(payload, payload.depth);
            return peer ? { poly, depth: payload.depth } : poly;
        },
        encodeReference: (reference) => {
            return {
                poly: new Polygon(),
                depth: reference.depth
            }
        }
    },
    CANVAS: {
        create (width, height) {
            const canvas = new OffscreenCanvas(width, height);
            return this.encode(canvas);
        },
        decode: (data, ref = false) => {
            const { canvas } = data;
            const reference = { width: canvas?.width, height: canvas?.height };
            const img = canvas.transferToImageBitmap();
            return {reference, payload: img, buffers: [img]};
        },
        encode: (payload, peer = true) => {
            if (peer) {
                const canvas = new OffscreenCanvas(payload?.width, payload?.height); // [!] inefficient but Contexts are non-transferrable and permanently linked to each Canvas
                const cursor = Canvas2DContextCursorFactory(canvas);
                cursor.drawImage(payload, 0, 0);
                payload?.close?.();
                return { canvas, cursor };
            } else {
                return payload;
            }
        },
        encodeReference: (reference) => {
            const canvas = new OffscreenCanvas(reference.width, reference.height);
            const cursor = Canvas2DContextCursorFactory(canvas);
            return { canvas, cursor };
        }
    },
};
Object.freeze(CACHE_TYPES);

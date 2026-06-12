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
        encode: (payload) => {
            return {
                poly: Polygon.fromObject(payload, payload.depth),
                depth: payload.depth
            };
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
        encode: (payload) => {
            const canvas = new OffscreenCanvas(payload?.width, payload?.height); // [!] inefficient but Contexts are non-transferrable and permanently linked to each Canvas
            const cursor = Canvas2DContextCursorFactory(canvas);
            cursor.drawImage(payload, 0, 0);
            payload?.close?.();
            return { canvas, cursor };
        },
        encodeReference: (reference) => {
            const canvas = new OffscreenCanvas(reference.width, reference.height);
            const cursor = Canvas2DContextCursorFactory(canvas);
            return { canvas, cursor };
        }
    },
};


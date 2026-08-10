import { packPolygon } from "/scripts/api/pack.js";
import { Terrain, Path, Polygon } from "/src/engine/core/Core.js";
import { Canvas2DContextCursor } from "/src/engine/core/controller/display/Canvas2DContextCursor.js";

export class RenderingCanvas {
    #terrain = new Terrain();
    constructor (canvasElement) {
        this.canvas = canvasElement;
        this.cursor = new Canvas2DContextCursor(canvasElement);
    }

    decode (points) {
        this.terrain.apply(new Polygon(Path.fromArray(points)).subsection(0.5));
    }
    pack () {
        return packPolygon(this.terrain.polygon);
    }
    render () {
        const { cursor, canvas } = this;
        const { polygon } = this.terrain;
        if (!polygon) return;
        const bbox = polygon.getBoundingBox();
        cursor.planeSize.x = canvas.width = bbox.width;
        cursor.planeSize.y = canvas.height = bbox.height;
        cursor.fixed = true;
        this.terrain.draw(cursor);
    }

    get terrain () { return this.#terrain }
}

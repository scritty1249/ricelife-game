import { drawTerrain, initTerrain } from "../../client/scripts/game/terrain/terrain.js";
import { Path, Polygon } from "../../client/scripts/game/geometry/geometry.js";
import { Canvas2DContextCursorFactory } from "../../client/scripts/game/controller/controller.js";
import { Phases } from "../../client/scripts/game/loop/loop.js";

export class RenderingCanvas {
    constructor (canvasElement) {
        this.canvas = canvasElement;
        this.cursor = Canvas2DContextCursorFactory(canvasElement);
    }

    computePolygon (arrayData) {
        this.polygon = initTerrain(new Polygon(Path.fromArray(arrayData))).subsection(0.5);
    }

    render () {
        const { cursor, canvas, polygon } = this;
        if (!polygon) return;
        const bbox = polygon.getBoundingBox();
        cursor.planeSize.x = canvas.width = bbox.width;
        cursor.planeSize.y = canvas.height = bbox.height;
        cursor.fixed = true;
        drawTerrain(cursor, polygon, Phases.RoundPhase.SETTINGS.TERRAIN_FILL, Phases.RoundPhase.SETTINGS.TERRAIN_EDGE, 75, 15);
    }
}

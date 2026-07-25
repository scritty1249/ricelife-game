import { Polygon } from "./Polygon.js";
import { Color } from "../math/Color.js";
import { Properties } from "../projectile/collision/Properties.js";

export class Terrain {
    static MAX_HOLE_DEPTH = 3;
    static fromObject (obj) {
        const { polygon, fill, edge, gradient, resolution, depth } = obj;
        const terrain = new Terrain(polygon, depth);
        terrain.fillColor.apply(fill);
        terrain.edgeColor.apply(edge);
        terrain.gradientWidth = gradient;
        terrain.resolution = resolution;
        return terrain;
    }
    #polygon;
    #fillColor = new Color();
    #edgeColor = new Color();
    gradientWidth = 75;
    resolution = 15;
    constructor (data, depth = Terrain.MAX_HOLE_DEPTH) {
        this.#polygon = data?.isPolygon
            ? data
            : Polygon.fromObject(data, depth);
        this.polygon.userData.collision = Properties.DESTRUCTION | Properties.ENTER | Properties.TERRAIN;
    }

    draw (cursor) {
        const { fillColor, edgeColor, gradientWidth, resolution, polygon } = this;
        cursor.save();
        cursor.lineCap = "round";
        cursor.lineJoin = "round";
        polygon.draw(cursor);
        cursor.fillStyle = fillColor.toString();
        cursor.fill();

        if (polygon.holes) {
            cursor.globalCompositeOperation = "destination-out";
            cursor.fillStyle = "black"; // mask color, abitrary
            for (const hole of polygon.holes) {
                hole.draw(cursor);
                cursor.fill();
                cursor.lineWidth = 1.5; // straight up mask a tiny extra bit around each hole lmao, we LOVE antialiasing!
                cursor.stroke();
            }        
            cursor.globalCompositeOperation = "source-over";
        }
        cursor.save();
        polygon.draw(cursor);
        cursor.clip();
        cursor.globalCompositeOperation = "source-atop";
        cursor.filter = `blur(${resolution}px)`;
        cursor.lineWidth = gradientWidth;
        cursor.strokeStyle = edgeColor.toRGBA();
        for (const edge of polygon.edges)
            edge.draw(cursor);
        cursor.stroke();
        cursor.restore();
        cursor.restore();
    }
    Float32 () {
        const { depth } = this.polygon;
        const polygon = this.polygon.Float32(depth);
        return {
            polygon, depth,
            fill: this.fillColor.toJSON(),
            edge: this.edgeColor.toJSON(),
            gradient: this.gradientWidth,
            resolution: this.resolution
        }
    }

    get isTerrain () { return true }
    get polygon () { return this.#polygon }
    get fillColor () { return this.#fillColor }
    get edgeColor () { return this.#edgeColor }
}

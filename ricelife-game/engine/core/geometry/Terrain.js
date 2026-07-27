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
    // options can fil the properties: fillColor, edgeColor, gradientWidth, resolution
    constructor (data, options = undefined) {
        this.apply(data, options)
    }

    #applyOptions (options) {
        if (!options) returnl
        if ("fillColor" in options) this.fillColor.apply(options.fillColor);
        if ("edgeColor" in options) this.edgeColor.apply(options.edgeColor);
        if ("gradientWidth" in options) this.gradientWidth = options.gradientWidth;
        if ("resolution" in options) this.resolution = options.resolution;
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
    apply (data, options = undefined, clone = false) {
        if (data?.isTerrain) {
            this.#polygon = clone ? data.polygon.clone(true) : data.polygon;
            this.#applyOptions(data);
        } else if (data?.isPolygon) {
            this.#polygon = clone ? data.clone(true) : data;
        } else {
            this.#polygon = Polygon.fromObject(data, data?.depth || Terrain.MAX_HOLE_DEPTH);
        }
        if (this.polygon?.isPolygon)
            this.polygon.userData.collision = Properties.DESTRUCTION | Properties.ENTER | Properties.TERRAIN;
        this.#applyOptions(options);
        return this;
    }
    clone (deep = false) {
        const terrain = new Terrain();
        return terrain.apply(this, undefined, deep);
    }

    get isTerrain () { return true }
    get polygon () { return this.#polygon }
    get fillColor () { return this.#fillColor }
    get edgeColor () { return this.#edgeColor }
}

import { Polygon } from "../geometry/geometry.js";
import { Properties } from "../projectile/projectile.js";
import { Unpack } from "../../api/api.js";

export async function loadTerrain (url) {
    const buffer = await Unpack.stream(url);
    const decoded = Unpack.unpackPolygon(buffer);
    const polygon = Polygon.fromObject(decoded);
    const terrain = initTerrain(polygon);
    return terrain;
}

export function initTerrain (terrainPolygon) {
    terrainPolygon.userData.collision = Properties.DESTRUCTION | Properties.ENTER | Properties.TERRAIN;
    return terrainPolygon;
}
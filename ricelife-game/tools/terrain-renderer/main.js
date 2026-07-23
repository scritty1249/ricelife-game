import { drawTerrain, initTerrain } from "../../client/scripts/game/terrain/terrain.js";
import { Canvas2DContextCursorFactory } from "../../client/scripts/game/controller/controller.js";
import { Phases } from "../../client/scripts/game/loop/loop.js";
import { unpackPolygon } from "../../client/scripts/api/unpack.js";
import { Polygon } from "../../client/scripts/game/geometry/geometry.js";

const canvas = document.getElementById("render");
const cursor = Canvas2DContextCursorFactory(canvas);
const exportBtn = document.getElementById("export");

document.getElementById("upload").addEventListener("change", async function (event) {
    const file = event.target.files[0];
    if (!file) return;
    const filename = file.name.substring(0, file.name.lastIndexOf("."));
    const buffer = await file.arrayBuffer();
    const decoded = unpackPolygon(buffer);
    const terrain = initTerrain(Polygon.fromObject(decoded));
    const plane = terrain.getBoundingBox();
    cursor.planeSize.x = canvas.width = plane.size.x;
    cursor.planeSize.y = canvas.height = plane.size.y;
    drawTerrain(cursor, terrain, Phases.RoundPhase.SETTINGS.TERRAIN_FILL, Phases.RoundPhase.SETTINGS.TERRAIN_EDGE, 75, 15);
    canvas.dataset.name = filename;
    exportBtn.classList.remove("disabled");
});

exportBtn.onclick = () => {
    const url = canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${canvas.dataset.name}.png`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
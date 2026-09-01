import { unpackPolygon } from "/scripts/api/unpack.js";
import { Terrain, Polygon } from "/src/engine/core/Core.js";
import { Canvas2DContextCursor } from "/src/engine/core/controller/display/Canvas2DContextCursor.js";

const canvas = document.getElementById("render");
const cursor = new Canvas2DContextCursor(canvas);
const exportBtn = document.getElementById("export");

document.getElementById("upload").addEventListener("change", async function (event) {
    const file = event.target.files[0];
    if (!file) return;
    const filename = file.name.substring(0, file.name.lastIndexOf("."));
    const buffer = await file.arrayBuffer();
    const decoded = unpackPolygon(buffer);
    const terrain = new Terrain(Polygon.fromObject(decoded));
    const plane = terrain.polygon.getBoundingBox();
    cursor.planeSize.x = canvas.width = plane.size.x;
    cursor.planeSize.y = canvas.height = plane.size.y;
    terrain.draw(cursor);
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
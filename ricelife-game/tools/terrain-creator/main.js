import { DrawingCanvas } from "./draw.js";
import { RenderingCanvas } from "./render.js";
import { Slider } from "./slider.js"
import { packPolygon } from "../../client/scripts/api/pack.js";

const exportBtn = document.getElementById("export-btn");
const modal = document.getElementById("export-modal");
const overlay = document.getElementById("modal-overlay");
const closeBtn = document.getElementById("close-btn");
const clearBtn = document.getElementById("clear-btn");
const sliderEl = document.getElementById('stabilizer-slider');
const thumbBtn = document.getElementById("thumb-btn");
const blobBtn = document.getElementById("blob-btn");
const renderBtn = document.getElementById("render-btn");
const mirrorBtn = document.getElementById("mirrored-toggle");

const StablizerSlider = new Slider(document.getElementById("stabilizer-slider"), document.getElementById("stabilizer-val"), 0, 250, 80, 1);
const Drawer = new DrawingCanvas(document.getElementById("draw-canvas"), StablizerSlider);
const Renderer = new RenderingCanvas(document.getElementById("render-canvas"));

const SmoothingPassSlider = new Slider(
    document.getElementById("passes-slider"),
    document.getElementById("passes-val"),
    0, 5, 2, 1
);
const SmoothingFactorSlider = new Slider(
    document.getElementById("factor-slider"),
    document.getElementById("factor-val"),
    0, 1, 0.55, 0.05
);
const SnapSlider = new Slider(
    document.getElementById("snap-slider"),
    document.getElementById("snap-val"),
    0, 500, 50, 5
);
const ScaleSliderX = new Slider(
    document.getElementById("scale-x-slider"),
    document.getElementById("scale-x-val"),
);
const ScaleSliderY = new Slider(
    document.getElementById("scale-y-slider"),
    document.getElementById("scale-y-val"),
);
const BaseSliderY = new Slider(
    document.getElementById("base-y-slider"),
    document.getElementById("base-y-val"),
    0, 1000, 50, 1,
);
const EMPTY_CANVAS_MESSAGE = "No Data.";

function loadOutput () {
    const updatedPayload = Drawer.exportData(ScaleSliderX.value, ScaleSliderY.value, BaseSliderY.value, mirrorBtn.checked);
    if (updatedPayload)
        Renderer.computePolygon(updatedPayload);
}

ScaleSliderX.onchange = () => loadOutput();
ScaleSliderY.onchange = () => loadOutput();
BaseSliderY.onchange = () => loadOutput();
mirrorBtn.addEventListener("change", () => loadOutput());
SmoothingPassSlider.onchange = () => Drawer.smoothingPasses = SmoothingPassSlider.value;
SmoothingFactorSlider.onchange = () => Drawer.smoothingFactor = SmoothingFactorSlider.value;
SnapSlider.onchange = () => Drawer.snapDistance = SnapSlider.value;

clearBtn.addEventListener("click", () => Drawer.clear());
exportBtn.addEventListener("click", () => {
    Drawer.enabled = false;
    loadOutput();
    Renderer.render();
    modal.classList.add("show");
});
closeBtn.addEventListener("click", () => {
    modal.classList.remove("show");
    ScaleSliderX.reset();
    ScaleSliderY.reset();
    Drawer.enabled = true;
});
thumbBtn.onclick = () => {
    const url = Renderer.canvas.toDataURL("image/png");
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `${Renderer.canvas.dataset.name}.png`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
blobBtn.onclick = () => {
    const buffer = packPolygon(Renderer.polygon);
    const blob = new Blob([buffer], { type: "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `terrain.bin`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}
renderBtn.onclick = () => Renderer.render();

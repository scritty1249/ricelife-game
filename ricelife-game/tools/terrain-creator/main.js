import { DrawingCanvas } from "./draw.js";
import { Slider } from "./slider.js"

const exportBtn = document.getElementById("export-btn");
const modal = document.getElementById("export-modal");
const overlay = document.getElementById("modal-overlay");
const outputBox = document.getElementById("output-box");
const closeBtn = document.getElementById("close-btn");
const clearBtn = document.getElementById("clear-btn");
const sliderEl = document.getElementById('stabilizer-slider');
const copyBtn = document.getElementById("copy-btn");
const csvBtn = document.getElementById("save-btn");

const StablizerSlider = new Slider(document.getElementById("stabilizer-slider"), document.getElementById("stabilizer-val"), 0, 250, 80, 1);
const Drawer = new DrawingCanvas(document.getElementById("draw-canvas"), StablizerSlider);

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
    0, 1000, 0, 1,
);
const EMPTY_CANVAS_MESSAGE = "No Data.";

function loadOutput () {
    const updatedPayload = Drawer.exportData(ScaleSliderX.value, ScaleSliderY.value, BaseSliderY.value);
    outputBox.value = updatedPayload
        ? updatedPayload
        : EMPTY_CANVAS_MESSAGE;
}
function hasOutputData () {
    return outputBox.value && !outputBox.value.startsWith(EMPTY_CANVAS_MESSAGE);
}

ScaleSliderX.onchange = () => loadOutput();
ScaleSliderY.onchange = () => loadOutput();
BaseSliderY.onchange = () => loadOutput();
SmoothingPassSlider.onchange = () => Drawer.smoothingPasses = SmoothingPassSlider.value;
SmoothingFactorSlider.onchange = () => Drawer.smoothingFactor = SmoothingFactorSlider.value;
SnapSlider.onchange = () => Drawer.snapDistance = SnapSlider.value;

clearBtn.addEventListener("click", () => Drawer.clear());
exportBtn.addEventListener("click", () => {
    Drawer.enabled = false;
    loadOutput();
    modal.style.display = "block";
    overlay.style.display = "block";
});
closeBtn.addEventListener("click", () => {
    modal.style.display = "none";
    overlay.style.display = "none";
    ScaleSliderX.reset();
    ScaleSliderY.reset();
    Drawer.enabled = true;
});
copyBtn.addEventListener("click", () => {
    if (!hasOutputData()) {
        alert("Nothing to copy!");
        return;
    }
    navigator.clipboard.writeText(outputBox.value)
        .then(() => {
            const originalText = copyBtn.textContent;
            copyBtn.textContent = "Copied!";
            copyBtn.style.background = "#1e7e34";
            setTimeout(() => {
                copyBtn.textContent = originalText;
                copyBtn.style.background = "#28a745";
            }, 1500);
        })
        .catch(err => {
            console.error("Failed to copy data to clipboard: ", err);
            outputBox.select();
            document.execCommand("copy");
            alert("Data highlighted, press Ctrl+C or Cmd+C to copy.");
        });
});
csvBtn.addEventListener("click", () => {
    if (!hasOutputData()) {
        alert("Nothing to save!");
        return;
    }
    const rows = outputBox.value.split("\n");
    const csvContent = rows.join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `terrain_${Date.now()}.csv`);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
});

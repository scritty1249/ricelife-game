import { stream, unpackPolygon } from "/scripts/api/unpack.js";

export default async function init (mainController) {
    const { default: maps } = await import("/data/map-manifest.json", { assert: { type: "json" } });
    const phase = await mainController.loadCreatePhase(maps);
    phase.Events.addEventListener("SELECTED", async (selected) => {
        try {
            const { name, src } = selected.map;
            mainController.Events.raiseEvent("LOADING", {hide: false, message: `Fetching map: ${name}`});
            const terrainBuffer = await stream(src);
            mainController.Events.raiseEvent("LOADING", {hide: false, message: "Loading map"});
            const terrainData = unpackPolygon(terrainBuffer);
            mainController.Events.raiseEvent("LOADING", {hide: false, message: "Starting round"});
            const round = await mainController.loadRoundPhase(lobby, terrainData, true);
            mainController.ActivePhase = round;
            mainController.Events.raiseEvent("LOADING", {hide: true});
        } catch (err) {
            console.log(err);
        }
    }, { once: true });
    mainController.ActivePhase = phase;
}

export async function load () {
    const phase = await main.loadCreatePhase(maps);
    phase.Events.addEventListener("SELECTED", async (selected) => {
        try {
            const { name, src } = selected.map;
            main.Events.raiseEvent("LOADING", {hide: false, message: `Fetching map: ${name}`});
            const terrainBuffer = await stream(src);
            main.Events.raiseEvent("LOADING", {hide: false, message: "Loading map"});
            const terrainData = unpackPolygon(terrainBuffer);
            main.Events.raiseEvent("LOADING", {hide: false, message: "Starting round"});
            const round = await main.loadRoundPhase(lobby, terrainData, true);
            main.ActivePhase = round;
            main.Events.raiseEvent("LOADING", {hide: true});
        } catch (err) {
            console.log(err);
            main.ActivePhase = main.Phases.Create;
        }
    }, { once: true });
    main.ActivePhase = phase;

    main.Display.canvas.focus();
    main.loop();
}
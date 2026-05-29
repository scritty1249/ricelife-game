export async function animateBlast (state, config, blastKeyframes) {

}

async function drawBlastKeyframe (state, config, blast) {

}

function uhhhName (state, config) {
    // start a worker draw job
    state.tracer = state.projectile.tracer;
    state.blastTerrain = state.terrain.clone();
    const frames = [];
    for (const blast of blasts) {
        frames.push(
            state.geometry.cut("blastTerrain", state.terrain, ...state.projectile.blast.shapesAt(state.landing.point))
        );
    }
}


// function animate (state, config) {
//     const nowStamp = performance.now();
//     const elapsed = nowStamp - state.lastStamp;
//     const player = state.tanks[config.playerTank];
//     let waitPromise = config.display.worker.cache.background ? Promise.resolve() : state.redrawJob;

//     if (elapsed < config.frameInterval) { // run any between-frame logic
//     } else { // redraw frame
//         state.lastStamp = nowStamp - (elapsed % config.frameInterval);
//         // check if background needs to be updated
//         if (state.projectile) {
//             if (state.terrain.isIntersecting(state.projectile.shape)) {
//                 state.projectile = false; // set to false to flag background cache for redraw
//             }
//         }
//         if (state.projectile === false) {
//             state.projectile = undefined;
//             waitPromise = state.redrawJob
//                 .then(() => config.display.copyCanvas("background", config.display.worker.cache.blastBackground.image))
//                 .then(() => state.terrain.apply(state.blastTerrain))
//                 .then(() => {
//                     player.position.round(2);
//                     if (state.terrain.holes.some((hole) => hole.isIntersecting(player.position))) // shallow check
//                         state.move.set(player.position.x); // update positioning - account for "falling"
//                 });
//         }
//         waitPromise = waitPromise.then(() => {
//             // Draw the screen (main game loop - related polygons and images)
//             drawFrame(state, config);
//             if (window?.debugTools || (URL_PARAMS.get("debug") === "true" && window?.debugTools !== false))
//                 // [!] testing
//                 drawDebugOverlay(state, config);
//         });
//     }
//     waitPromise.then(() => {
//         handleInput(state, config);
//         requestAnimationFrame(() => animate(state, config));
//     });
// }
// async function fireProjectile (shot, state, config) { // [!} laziness
//     state.projectile = new shot(state.tanks[config.playerTank].barrelPos, state.move.rotation + 270, state.aimer.power);
//     state.tracer = state.projectile.tracer;
//     state.blastTerrain = state.terrain.clone();
//     state.landing = state.projectile.intersectAt(state.blastTerrain, 1/config.fps, config.display.size.x); // [!] for testing
//     if (state.landing) {
//         state.redrawJob = state.geometry.cut("blastTerrain", state.terrain, ...state.projectile.blast.shapesAt(state.landing.point))
//             .then((polygon) => polygon.roundPoints(2))
//             .then((polygon) => state.blastTerrain.apply(polygon))
//             .then((polygon) => config.display.drawTerrain("blastBackground", state.blastTerrain, config.terrain.fill, config.terrain.edge));
//     }
// }
let loadingElement;

export function showLoadingScreen () { loadingElement.classList.remove("hidden"); loadingElement.classList.add("loading-state") }
export function showBusyScreen () { loadingElement.classList.remove("hidden"); loadingElement.classList.add("busy-state") }
export function showErrorScreen () { loadingElement.classList.remove("hidden"); loadingElement.classList.add("error-state") }
export function showSpinnerScreen () { loadingElement.classList.remove("hidden") }
export function hideLoadingScreen () { loadingElement.classList.add("hidden"); loadingElement.classList.remove("busy-state", "loading-state") }

export function init () {
    // add event listeners
    const eventTarget = window.appCanvas;
    loadingElement = document.getElementById("loading-screen");
    eventTarget.addEventListener("APP_loading", showLoadingScreen); // app is loading assets / running initalization
    eventTarget.addEventListener("APP_busy", showBusyScreen); // app is loaded, and processing something
    eventTarget.addEventListener("APP_ready", hideLoadingScreen); // app is done loading / not "busy"- ready for user input
    eventTarget.addEventListener("APP_error", showErrorScreen); // crashed
}
let loadingElement;
let loadingCaption;

export function loading (data) {
    if (data?.error) {
        loadingElement.classList.add("error-state");
    } else if (data?.error === false) {
        loadingElement.classList.remove("error-state");
    } else if (loadingElement.classList.contains("error-state")) {
        return; // don't overwrite errors
    }
    if (data?.hide) {
        loadingElement.classList.add("hidden");
    } else {
        loadingElement.classList.remove("hidden");
    }
    if (data?.message) {
        loadingCaption.innerHTML = data.message;
    } else {
        loadingCaption.innerHTML = "";
    }
    if (data?.cover) {
        loadingElement.classList.add("cover");
    } else {
        loadingElement.classList.remove("cover");
    }
}

export function init () {
    loadingElement = document.getElementById("loading-screen");
    loadingCaption = document.getElementById("loading-caption");
}
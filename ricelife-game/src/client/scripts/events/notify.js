let messageStream;

export function notify (message, severity, timeout) {
    const element = createMessageElement(message);
    if (severity === 2)
        element.classList.add("error");
    else if (severity === 1)
        element.classList.add("warn");
    if (Number.isFinite(timeout) && timeout > 0) {
        setTimeout(() => {
            removeMessage(element);
        }, timeout);
    }
}

export function init () {
    messageStream = document.getElementById("notif-stream");
    messageStream.addEventListener("click", removeMessageHandler);
}

function removeMessageHandler (event) {
    const element = event.target.closest(".icon-notif");
    removeMessage(element);
}

function removeMessage (element) {
    if (!element || element.classList.contains("closing")) return;
    element.classList.add("closing");
    element.addEventListener("transitionend", (e) => {
        if (e.propertyName === "max-height") element.remove();
    });
}

function createMessageElement (message) {
    const element = document.createElement("span");
    element.classList.add("icon-notif");
    const content = document.createElement("div");
    content.classList.add("notif-content");
    content.innerText = message;
    element.append(content);
    messageStream.append(element);
    return element;
}
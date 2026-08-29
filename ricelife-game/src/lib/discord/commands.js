import { generateMessageEndpoint } from "./interaction.js";

export function invalid () { // discord will purposefully send invalid requests to periodically test the endpoint
    console.info("Recieved an invalid interaction request");
    return new Response("invalid request signature", {status: 401}); // specified by discord api guidelines
}

export function launch () {
    console.debug("Application launched");
    return Response.json({
        type: 12,
        data: {
            flags: 4 // send as silent message
        }
    });
}

export function acknowledge () {
    return Response.json({type: 1}); // ACK/PONG
}

export function defer (ephemeral = true) {
    console.debug("Deferred response");
    return Response.json({
        type: 5,
        data: {
            flags: ephemeral ? 64 : 0 // message is ephemeral- only visible to invoker
        }
    });
}

export function message (content, ephemeral = true) {
    return Response.json({
        type: 4,
        data: {
            content: content,
            flags: ephemeral ? 80 : 16 // notificaitons suppressed, 1 << 4
        }
    });
}

export async function response (content, token) {
    return await fetch(generateMessageEndpoint(token), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: content })
    }).then(response => {
        console.debug(`Response deferred for interaction ${token}`);
        return response;
    });
}

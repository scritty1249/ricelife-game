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
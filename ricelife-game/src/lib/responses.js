import { printError } from "./main.js";

export function error (err) {
    printError(err);
    return Response.json({error: err?.message}, {status: 500, statusText: "Internal server error"});
}

export function invalid () {
    return Response.json({error: "Invalid or missing request content"}, { status: 422 });
}

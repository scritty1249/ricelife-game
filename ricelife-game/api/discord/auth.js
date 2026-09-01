import { CLIENT_ID, authenticate } from "@server/lib/discord/auth.js";
import * as Responses from "@server/lib/responses.js";

export async function POST (request) {
    const { code }  = await request.json();
    if (!code) {
        return new Response("Missing required payload.", {status: 400, statusText: "Missing required payload."});
    } else {
        try {
            const accessToken = await authenticate(code);
            return Response.json({token: accessToken});
        } catch (err) {
            console.error("Fetch error:", err);
            return Response.json({error: err.message}, {status: 500, statusText: "Internal server error"});
        }
    }
}

export async function GET (request) {
    try {
        return Response.json({id: CLIENT_ID});
    } catch (err) {
        console.error("Environment variable error");
        return Responses.error(err);
    }
}
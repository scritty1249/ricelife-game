import { lobbyHasPlayer, lobbyIsWaiting, getTerrainUrl, stageUpdate } from "../../../lib/lobby/manage.js";
import { printError } from "../../../lib/main.js";

const DEV_PROD = process.env.NODE_ENV === "development";

export async function GET (request) {
    try {
        const { searchParams } = new URL(request.url);
        const lobbyid = searchParams.get("lobbyid");
        const playerid = searchParams.get("userid");
        const isParticipant = await lobbyHasPlayer(lobbyid, playerid);
        if (isParticipant) {
            const { url, ttl } = await getTerrainUrl(lobbyid);
            return Response.json({ url, ttl });
        } else {
            return new Response("Players must be in lobby to get terrain data", {status: 403});
        }
    } catch (error) {
        printError(error);
        return Response.json({error: error.message}, {status: 500, statusText: "Internal server error"});
    }
}

export async function POST (request) {
    try {
        const { userid: playerid, lobbyid, keep = false } = await request.json();
        const isParticipant = await lobbyHasPlayer(lobbyid, playerid);
        const isWaiting = await lobbyIsWaiting(lobbyid);
        if (isWaiting) {
            return new Response("Lobby must be started to stage updates", {status: 403});
        } else if (isParticipant) {
            const result = await stageUpdate(lobbyid, !keep);
            return Response.json(result);
        } else {
            return new Response("Players must be in lobby to participate", {status: 403});
        }
    } catch (error) {
        printError(error);
        return Response.json({error: error.message}, {status: 500, statusText: "Internal server error"});
    }
}

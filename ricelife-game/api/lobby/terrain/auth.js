import { lobbyHasPlayer, getTerrainUrl, stageUpdate } from "../../../lib/lobby/manage";

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
            return Response.json({}, {status: 403, statusText: "Players must be in lobby to get terrain data."});
        }
    } catch (error) {
        console.error(error);
        return Response.json({error: error.message}, {status: 500, statusText: "Internal server error"});
    }
}

export async function POST (request) {
    try {
        const { userid: playerid, lobbyid, keep = false } = await request.json();
        const isParticipant = await lobbyHasPlayer(lobbyid, playerid);
        if (isParticipant) {
            const result = await stageUpdate(lobbyid, !keep);
            return Response.json(result);
        } else {
            return Response.json({}, {status: 403, statusText: "Players must be in lobby to get terrain data."});
        }
    } catch (error) {
        console.error(error);
        return Response.json({error: error.message}, {status: 500, statusText: "Internal server error"});
    }
}

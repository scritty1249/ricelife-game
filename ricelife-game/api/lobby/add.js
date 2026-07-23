import { lobbyIsWaiting, addPlayer } from "../../lib/lobby/manage.js";
import { printError } from "../../lib/main.js";

const DEV_PROD = process.env.NODE_ENV === "development";

export async function POST (request) {
    try {
        const { player, lobbyid, teamid } = await request.json();
        const isWaiting = await lobbyIsWaiting(lobbyid);
        if (isWaiting) {
            const success = await addPlayer(lobbyid, player, teamid);
            return Response.json({ success });
        } else {
            return new Response("Cannot join an active lobby.", {status: 403, statusText: "Cannot join an active lobby."});
        }
    } catch (error) {
        printError(error);
        return Response.json({error: error.message}, {status: 500, statusText: "Internal server error"});
    }
}

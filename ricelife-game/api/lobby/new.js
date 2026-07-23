import { createLobby } from "../../lib/lobby/manage.js";
import { printError } from "../../lib/main.js";

const DEV_PROD = process.env.NODE_ENV === "development";

export async function POST (request) {
    try {
        const { player, mapid, channelid, teamsize, teamcount } = await request.json();
        const lobbyid = await createLobby(player, channelid, mapid, teamsize, teamcount);
        return Response.json({ lobbyid });
    } catch (error) {
        printError(error);
        return Response.json({error: error.message}, {status: 500, statusText: "Internal server error"});
    }
}

import { addPlayer } from "../../lib/lobby/manage";

const DEV_PROD = process.env.NODE_ENV === "development";

export async function POST (request) {
    try {
        const { player, lobbyid, teamid } = await request.json();
        const success = await addPlayer(lobbyid, player, teamid);
        return Response.json({ success });
    } catch (error) {
        console.error(error);
        return Response.json({error: error.message}, {status: 500, statusText: "Internal server error"});
    }
}

import { exportLobby } from "../../lib/lobby/manage";

const DEV_PROD = process.env.NODE_ENV === "development";

export async function GET (request) {
    try {
        const { searchParams } = new URL(request.url);
        const lobbyid = searchParams.get("lobbyid");
        const lobby = await exportLobby(lobbyid);
        return Response.json({ lobby });
    } catch (error) {
        console.error(error);
        return Response.json({error: error.message}, {status: 500, statusText: "Internal server error"});
    }
}

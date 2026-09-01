import { exportLobby } from "@server/lib/lobby/manage.js";
import * as Responses from "@server/lib/responses.js";

const DEV_PROD = process.env.NODE_ENV === "development";

export async function GET (request) {
    try {
        const { searchParams } = new URL(request.url);
        const lobbyid = searchParams.get("lobbyid");
        const lobby = await exportLobby(lobbyid);
        return Response.json({ lobby });
    } catch (error) {
        return Responses.error(error);
    }
}

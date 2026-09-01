import { exportLobby } from "@server/lib/lobby/manage.js";
import * as Responses from "@server/lib/responses.js";

const DEV_PROD = process.env.NODE_ENV === "development";

export async function GET (request) {
    try {
        const { searchParams } = new URL(request.url);
        const lobbyid = searchParams.get("lobbyid");
        const hostid = searchParams.get("hostid") ?? undefined;
        const exportedData = await exportLobby(lobbyid, hostid);
        return Response.json(exportedData);
    } catch (error) {
        return Responses.error(error);
    }
}

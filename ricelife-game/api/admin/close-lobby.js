import { closeLobby } from "../../lib/lobby/manage.js";
import { printError } from "../../lib/main.js";

const DEV_PROD = process.env.NODE_ENV === "development";

export async function POST (request) {
    try {
        const { lobbyid, authorization } = await request.json();
        const success = await closeLobby(lobbyid);
        return Response.json({ success });
    } catch (error) {
        printError(error);
        return Response.json({error: error.message}, {status: 500, statusText: "Internal server error"});
    }
}

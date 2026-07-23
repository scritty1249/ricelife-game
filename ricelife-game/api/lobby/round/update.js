import { verifyToken, commitUpdate } from "../../../lib/lobby/manage.js";
import { printError } from "../../../lib/main.js";

const DEV_PROD = process.env.NODE_ENV === "development";

export async function POST (request) {
    try {
        const { token, lobbyid, players = {} } = await request.json();
        const now = Date.now() / 1000;
        if (await verifyToken(lobbyid, token, now)) {
            await commitUpdate(lobbyid, token, players);
            return new Response();
        } else {
            return new Response("Invalid token", {status: 403});
        }
    } catch (error) {
        printError(error);
        return Response.json({error: error.message}, {status: 500, statusText: "Internal server error"});
    }
}

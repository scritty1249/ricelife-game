import { verifyToken, commitUpdate } from "../../../lib/lobby/manage";

const DEV_PROD = process.env.NODE_ENV === "development";

export async function POST (request) {
    try {
        const { token, lobbyid, players = [] } = await request.json();
        const now = Date.now() / 1000;
        if (await verifyToken(lobbyid, token, now)) {
            await commitUpdate(lobbyid, token, players);
            return new Response();
        } else {
            return Response.json({}, {status: 403, statusText: "Invalid token"});
        }
    } catch (error) {
        console.error(error);
        return Response.json({error: error.message}, {status: 500, statusText: "Internal server error"});
    }
}

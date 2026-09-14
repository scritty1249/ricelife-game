export const CONNECTION_URL = process.env.SUPABASE_URL;
export const CONNECTION_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

export function generateChannelID (lobbyid) {
    return `LOBBY_${lobbyid}`;
}
import { DISCORD_AUTH } from "../endpoints.js";

export const CLIENT_ID = process.env.DISCORD_ID;

export async function authenticate (clientCode) {
    const response = await fetch(DISCORD_AUTH, {
        method: "POST",
        headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
            client_id: process.env.DISCORD_ID,
            client_secret: process.env.DISCORD_SECRET,
            grant_type: "authorization_code",
            code: clientCode,
        }),
    });
    const { access_token } = await response.json();
    return access_token;
}
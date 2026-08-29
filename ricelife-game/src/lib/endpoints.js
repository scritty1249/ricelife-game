export const DISCORD_API_VERSION = 10;

export const DISCORD_AUTH = "https://discord.com/api/oauth2/token";
export const DISCORD_API_BASE = `https://discord.com/api/v${DISCORD_API_VERSION}`
export const DISCORD_WEBHOOK_BASE = `${DISCORD_API_BASE}/webhooks/${process.env.DISCORD_ID}`;
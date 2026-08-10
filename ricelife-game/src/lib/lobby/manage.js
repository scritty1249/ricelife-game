import * as BLOB from "../storage/blob.js";
import * as KV from "../storage/kv.js";
import { Snowflake } from "../snowflake.js";
import { STATUS } from "./properties.js";
import { createPlayer } from "./player.js";
import { generateToken } from "../token.js";

const SNOWFLAKE = new Snowflake(0);
const STAGING_TTL = 60; // seconds
const DOWNLOAD_TTL = 180; // seconds

export function generateTerrainPath (lobbyid) {
    return `terrain/lobbies/${lobbyid}/terrain.bin`;
}

function generateStagedTerrainPath (lobbyid, token) {
    return `terrain/staged/${lobbyid}/terrain-${token}.bin`;
}

function generateMapPath (mapid) {
    return `terrain/MASTER/${mapid}.bin`;
}

export async function lobbyHasPlayer (lobbyid, playerid) {
    return await KV.exists(lobbyid, `players.${playerid}`)
}

export async function lobbyIsWaiting (lobbyid) {
    return (await KV.get(lobbyid, "state"))?.state === STATUS.WAITING;
}

export async function exportLobby (lobbyid) {
    const lobby = await KV.get(lobbyid);
    if (!lobby) return null;
    return {
        players: lobby.players,
        state: lobby.state,
        teamsize: lobby.team_size,
        teamcount: lobby.team_count,
        channelid: lobby.channelid
    };
}

export async function getTerrainUrl (lobbyid) {
    const now = Math.ceil(Date.now() / 1000);
    const key = generateTerrainPath(lobbyid);
    const expires = Math.floor(Date.now() / 1000) + DOWNLOAD_TTL;
    const url = await BLOB.downloadUrl(key, DOWNLOAD_TTL);
    return {
        url,
        ttl: expires - Math.ceil(Date.now() / 1000)
    };
}

export async function addPlayer (lobbyid, playerProfile, team) {
    if (!playerProfile?.userid) return false;
    const playerInstance = createPlayer(playerProfile.userid, playerProfile.name, playerProfile.avatar, team);
    const result = await KV.set(lobbyid, `players.${playerProfile.userid}`, playerInstance);
    return result ? true : false;
}

export async function createLobby (playerProfile, channelid, mapid, teamsize, teamcount) {
    const lobbyid = SNOWFLAKE.generate();
    const playerInstance = createPlayer(playerProfile.userid, playerProfile.name, playerProfile.avatar, "0");
    const terrainPath = generateTerrainPath(lobbyid);
    const mapPath = generateMapPath(mapid);
    const res = BLOB.copy(mapPath, terrainPath);
    const result = KV.create(lobbyid, {
        state: STATUS.WAITING,
        players: { [playerProfile.userid]: playerInstance },
        terrain: terrainPath,
        team_size: teamsize || 1,
        team_count: teamcount > 1 ? teamcount : 2,
        channelid: channelid,
        // internal use
        update_token: "",
        update_expires: -1, // seconds
    });
    if (await result === null) throw new Error("Failed to create lobby");
    await res;
    console.info("Created lobby " + lobbyid);
    return lobbyid;
}

export async function closeLobby (lobbyid) {
    try {
        const terrainPath = generateTerrainPath(lobbyid);
        await Promise.all([
            KV.remove(lobbyid),
            BLOB.remove(terrainPath)
        ]);
        console.info("Closed lobby " + lobbyid);
        return true;
    } catch (error) {
        console.error("Failed to close lobby " + lobbyid)
        return false;
    }
}

// part 1 of atomic operation
// stage terrain update, drop changes if part 2 of operation is not completed in time
export async function stageUpdate (lobbyid, terrainchanged) {
    const token = generateToken();
    const ttlms = Date.now() + (STAGING_TTL * 1000);
    const ttl = Math.floor(ttlms / 1000);
    const result = { token };
    let update;
    if (terrainchanged) {
        const stagedPath = generateStagedTerrainPath(lobbyid, token);
        const url = await BLOB.uploadUrl(stagedPath, STAGING_TTL);
        await KV.update(lobbyid,
            "update_token", token,
            "update_expires", ttl
        );
        result.url = url;
    } else {
        await KV.update(lobbyid,
            "update_token", token,
            "update_expires", -1
        );
    }
    const remainingTtl = Math.floor((ttlms - Date.now()) / 1000);
    result.ttl = remainingTtl;
    if (remainingTtl <= 0) {
        console.warn(`Returning a staging TTL of ${remainingTtl}. Is staging duration limit too small?`);
    }
    return result;
}

// part 2 of atomic update
// commit changes in S3 Bucket, then upload player details to DynamoDB
export async function commitUpdate (lobbyid, token, players) {
    const jobs = [];
    // commit staged terrain in s3 bucket ASAP, before it expires
    const stagedPath = generateStagedTerrainPath(lobbyid, token);
    const terrainPath = generateTerrainPath(lobbyid);
    if (await BLOB.exists(stagedPath))
        jobs.push(BLOB.copy(stagedPath, terrainPath));
    // apply updates to players
    // [!] send commands individually so condition only fails per player
    for (const [ id, player ] of Object.entries(players))
        jobs.push(KV.update(lobbyid, `players.${id}`, player));
    // clear staging state data
    jobs.push(KV.update(lobbyid,
        "update_token", "",
        "update_expires", -1
    ));
    await jobs;
}

// now expected in seconds
export async function verifyToken (lobbyid, token, now) {
    const { update_token, update_expires } = await KV.get(lobbyid, "update_token", "update_expires");
    return update_token === token && now <= update_expires;
}

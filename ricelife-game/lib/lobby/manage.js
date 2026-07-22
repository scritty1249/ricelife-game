import * as BLOB from "../storage/blob.js";
import * as KV from "../storage/kv.js";
import { Snowflake } from "../snowflake.js";
import { STATUS } from "./properties.js";
import { createPlayer } from "./player.js";
import { generateToken } from "../token.js";

const SNOWFLAKE = new Snowflake(0);
const STAGING_TTL = 60; // seconds

export async function createLobby (player, channelid, mapid, teamsize, teamcount) {
    const lobbyid = SNOWFLAKE.generate();
    const player = createPlayer(player.id, player.name, player.avatar, team);
    const terrainPath = `${lobbyid}/terrain.bin`;
    const mapPath = `MASTER/${mapid}.bin`;
    const res = BLOB.copy(mapPath, terrainPath);
    const result = KV.create(lobbyid, {
        state: STATUS.WAITING,
        players: { [player.data.profile.userid]: player },
        terrain: terrainPath,
        team_size: teamsize || 1,
        team_count: teamcount > 1 ? teamcount : 2,
        channelid: channelid,
        // internal use
        update_token: "",
        update_expires: -1, // seconds
        download_url: "",
        download_expires: -1 // seconds
    });
    if (await result === null) throw new Error("Failed to create lobby");
    await res;
    return lobbyid;
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
        const url = await BLOB.uploadUrl(`${lobbyid}/terrain-${token}.bin`, STAGING_TTL);
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
    const stagedPath = `${lobbyid}/terrain-${token}.bin`;
    if (await BLOB.exists(stagedPath))
        jobs.push(BLOB.copy(stagedPath, `${lobbyid}/terrain.bin`));
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
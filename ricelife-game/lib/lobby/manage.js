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
        // internal use only
        update_staged: false,
        update_token: "",
        upload_expires: -1,
        upload_url: "",
        download_expires: -1,
        download_url: ""
    });
    if (await result === null) throw new Error("Failed to create lobby");
    await res;
    return lobbyid;
}

// part 1 of atomic operation
// stage terrain update, drop changes if part 2 of operation is not completed in time
export async function stageUpdate (lobbyid, terrainchanged) {
    const token = generateToken();
    const result = { token };
    let update;
    if (terrainchanged) {
        const ttlms = Date.now() + (STAGING_TTL * 1000);
        const ttl = Math.floor(ttlms / 1000);
        const url = await BLOB.uploadUrl(`${lobbyid}/terrain-${token}.bin`, STAGING_TTL);
        await KV.update(lobbyid, {
            update_staged: true,
            update_token: token,
            upload_url: url,
            upload_expires: ttl
        });
        result.url = url;
        result.ttl = Math.floor((ttlms - Date.now()) / 1000);
    } else {
        await KV.update(lobbyid, {
            updated_staged: false,
            update_token: ""
        });
    }
    return result;
}

// part 2 of atomic update
// upload player details to DynamoDB, then commit changes in S3 Bucket
export async function commitUpdate (lobbyid, players = []) {
    // apply updates to players
    // push to dynamodb
}
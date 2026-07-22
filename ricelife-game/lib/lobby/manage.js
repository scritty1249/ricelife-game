import * as BLOB from "../storage/blob.js";
import * as KV from "../storage/kv.js";
import { Snowflake } from "../snowflake.js";
import { STATUS } from "./properties.js";
import { createPlayer } from "./player.js";

const SNOWFLAKE = new Snowflake(0);

export async function create (player, channelid, mapid, teamsize, teamcount) {
    const lobbyid = SNOWFLAKE.generate();
    const player = createPlayer(player.id, player.name, player.avatar, team);
    const terrainPath = `${lobbyid}/terrain.bin`;
    const mapPath = `MASTER/${mapid}.bin`;
    const res = BLOB.copy(mapPath, terrainPath);
    const result = KV.create(lobbyid, {
        state: STATUS.WAITING,
        players: [player],
        terrain: terrainPath,
        teamsize: teamsize || 1,
        teamcount: teamcount > 1 ? teamcount : 2,
        channelid: channelid
    });
    if (await result === null) throw new Error("Failed to create lobby");
    await res;
    return lobbyid;
}
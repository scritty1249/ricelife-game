import { PlayerData, PlayerProfile, PlayerModel, PlayerInstance } from "../../client/scripts/game/player/player.js";

export function createPlayer (userid, username, avatar, team) {
    const model = new PlayerModel("basic");
    const profile = new PlayerProfile(username, avatar, userid);
    const data = new PlayerData(model, profile, team);
    const instance = new PlayerInstance(data);
    return instance.toJSON();
}
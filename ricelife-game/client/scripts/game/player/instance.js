import { TrackableObject } from "../utils/utils.js";
import { Vector } from "../geometry/geometry.js";
import { HitPoints, HitPointTypes } from "./hitpoints.js";
import { PlayerData } from "./data.js";
import { TankController, AimController, MovementController } from "../controller/controller.js";

// wrapper for anything player related. includes controllers
export class PlayerInstance extends TrackableObject  {
    static fromObject (obj, modelVariant = "ally") {
        const { data, hitpoints, position } = obj;
        const h = HitPoints.fromObject(hitpoints);
        const d = PlayerData.fromObject(data, modelVariant);
        const p = Vector.fromObject(position);
        const other = new PlayerInstance(d, h);
        other.onload = function () { this.mover.apply(p) }
        return other;
    }
    #data;
    #hitpoints;
    #mover;
    #aimer;
    #tank;
    #isMain = false; // is main player? flag for game loop
    #isLoaded = false;
    #onloadCallbacks = new Array(); // support addition of mulitple onload callbacks, ran in order they were set
    constructor (data, hitpoints = undefined) {
        super();
        this.#data = data;
        this.#hitpoints = hitpoints || new HitPoints(new HitPointTypes.Health(100), new HitPointTypes.Shield(20));
    }

    #applyStyling () {
        const { profile, model } = this.data;
        model.body.width = 50;
        model.barrel.scale.apply(model.body.scale);
        profile.fontColor.apply(255, 255, 255);
        profile.avatar.width = 25;
        profile.nameOffset.y = model.body.height * 1.5;
        profile.avatarOffset.y = model.body.height * 2.4;
        this.hitpoints.barOffset.y += model.body.height * 1;
        this.hitpoints.barHeight = 8;
        this.hitpoints.barWidth = model.body.width;
    }

    async load (terrain) {
        if (this.#isLoaded) throw new Error(`[${this.constructor.name}]: Failed to load - already loaded`);
        await this.data.onload;
        this.#applyStyling();
        this.#tank = new TankController(this.data.model.body, this.data.model.barrel, new Vector());
        this.#aimer = new AimController(this.tank, this.tank.width * 3);
        this.#mover = new MovementController(terrain, this.tank,  -(this.tank.offset.body.y / 10));
        this.#isLoaded = true;
        for (const onload of this.onload) onload?.();
        return this; // for chaining
    }
    toJSON () {
        // [!] don't store aiming angle- save on backend storage, don't think anyone will notice/care... - KT
        return {
            data: this.data.toJSON(),
            hitpoints: this.hitpoints.toJSON(),
            position: this.tank.position.toJSON()
        };
    }

    get isPlayer () { return true }
    get data () { return this.#data }
    get tank () { return this.#tank }
    get aimer () { return this.#aimer }
    get mover () { return this.#mover }
    get hitpoints () { return this.#hitpoints }
    get onload () { return this.#onloadCallbacks }
    set onload (callbackFn) {
        const callback = callbackFn?.bind(this);
        this.#onloadCallbacks.push(callback);
        return callback;
    }
    get isMain () { return this.#isMain }
    set isMain (value) { return (this.#isMain = Boolean(value)) }
}
import { TrackableObject } from "../utils/utils.js";
import { Vector } from "../geometry/geometry.js";
import { HitPoints, HitPointTypes } from "./hitpoints.js";
import { PlayerData } from "./data.js";
import { TankController, AimController, MovementController } from "../controller/controller.js";

// wrapper for anything player related. includes controllers
export class PlayerInstance extends TrackableObject  {
    static fromObject (obj) {
        const { data, hitpoints, position } = obj;
        const h = HitPoints.fromObject(hitpoints);
        const d = PlayerData.fromObject(data);
        const other = new PlayerInstance(d, h);
        if (position) {
            const p = Vector.fromObject(position);
            if (!p.equals(0)) other.onload = function () { this.mover.apply(p) }
            else console.warn(`[${this.name}]: Invalid position from object for player ${other.data.profile.name} (${other.data.profile.userid})`);
        }
        return other;
    }
    #data;
    #hitpoints;
    #mover;
    #aimer;
    #tank;
    #canvasCursor; // mainly used to compute player display name width. Store for any future use
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
        profile.fontSize = 18;
        const nameWidth = profile.getNameWidth(this.#canvasCursor);
        const profileLinePadding = 5;
        profile.fontColor.apply(255, 255, 255);
        profile.avatar.width = 25;
        profile.nameOffset.x = ((nameWidth + profile.avatar.width) / 2) - (nameWidth / 2);
        profile.avatarOffset.x = profile.nameOffset.x - (nameWidth / 2) - (25 / 2) - profileLinePadding;
        profile.avatarOffset.y = profile.nameOffset.y = model.body.height * 2.6;

        this.hitpoints.barOffset.y += model.body.height * 2;
        this.hitpoints.barHeight = 8;
        this.hitpoints.barWidth = model.body.width;
    }

    async load (terrain, body, barrel, cursor) {
        if (this.#isLoaded) throw new Error(`[${this.constructor.name}]: Failed to load - already loaded`);
        this.#canvasCursor = cursor;
        await this.data.load(body, barrel);
        this.#applyStyling();
        this.#tank = new TankController(this.data.model.body, this.data.model.barrel, new Vector());
        this.#aimer = new AimController(this.tank, this.tank.width * 3);
        this.#mover = new MovementController(terrain, this.tank,  -(this.tank.offset.body.y / 10), this.tank.height / 2);
        this.#isLoaded = true;
        for (const onload of this.onload) onload?.();
        return this; // for chaining
    }
    drawProfile (cursor) {
        const { data, tank, hitpoints, isMain, isDead } = this;
        cursor.save();
        if (isDead) {
            cursor.filter = "grayscale(100%)";
            data.profile.fontColor.apply(100, 100, 100); // [!] inefficient
        }
        if (!isMain) data.profile.draw(cursor, tank.relativePosition);
        hitpoints.draw(cursor, tank.relativePosition);
        cursor.restore();
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
    get isDead () { return this.hitpoints.isZero }
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
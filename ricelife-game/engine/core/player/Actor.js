import { TrackableObject } from "../utils/utils.js";
import { Vector } from "../geometry/geometry.js";
import { HitPoints, HitPointTypes } from "./hitpoints.js";
import { PlayerData } from "./data.js";
import { TankController, AimController, MovementController } from "../controller/controller.js";
import { Properties } from "../projectile/collision/Properties.js";

// wrapper for anything player related. includes controllers
export class Actor extends TrackableObject  {
    static fromObject (obj) {
        const { data, hitpoints, position } = obj;
        const h = HitPoints.fromObject(hitpoints);
        const d = PlayerData.fromObject(data);
        const other = new Actor(d, h);
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
    #originalStyling = {};
    constructor (data, hitpoints = undefined) {
        super();
        this.#data = data;
        this.#hitpoints = hitpoints || new HitPoints(new HitPointTypes.Health(100), new HitPointTypes.Shield(20));
        this.#saveStyling();
    }

    #saveStyling () {
        const styling = this.#originalStyling;
        styling.barOffset = this.hitpoints.barOffset.clone();
    }

    applyStyling () {
        const original = this.#originalStyling;
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

        this.hitpoints.barOffset.y = original.barOffset.y + model.body.height * 2;
        this.hitpoints.barHeight = 8;
        this.hitpoints.barWidth = model.body.width;
    }

    async load (terrain, body, barrel, cursor) {
        if (this.#isLoaded) throw new Error(`[${this.constructor.name}]: Failed to load - already loaded`);
        this.#canvasCursor = cursor;
        await this.data.load(body, barrel);
        this.applyStyling();
        this.#tank = new TankController(this.data.model.body, this.data.model.barrel, new Vector());
        this.#aimer = new AimController(this.tank, this.tank.width * 3);
        this.#mover = new MovementController(terrain, this.tank,  -(this.tank.offset.body.y / 10), this.tank.height / 2);
        this.#isLoaded = true;
        for (const onload of this.onload) onload?.(this);
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
        const payload = {
            data: this.data.toJSON(),
            hitpoints: this.hitpoints.toJSON(),
        };
        if (this.#isLoaded)
            payload.position = this.tank.position.toJSON();
        return payload;
    }

    get isActor () { return true }
    get isDead () { return this.hitpoints.isZero }
    get data () { return this.#data }
    get tank () { return this.#tank }
    get aimer () { return this.#aimer }
    get mover () { return this.#mover }
    get hitpoints () { return this.#hitpoints }
    get onload () { return this.#onloadCallbacks }
    set onload (callbackFn) {
        this.#onloadCallbacks.push(callbackFn);
        if (this.#isLoaded) callbackFn?.(this);
        return callbackFn;
    }
    get isMain () { return this.#isMain }
    set isMain (value) { return (this.#isMain = Boolean(value)) }
}

import { Aimer } from "./Aimer.js";
import { Mover } from "./Mover.js";
import { Puppet } from "./Puppet.js";
import { Metadata } from "./Metadata.js";
import { HitTotal } from "./HitTotal.js";
import { Loadable } from "../load/Loadable.js";
import { typeString } from "../utils/logging.js";
import { Vector } from "../math/Vector.js";

export class Actor extends Loadable {
    static fromObject (obj) {
        const { data, hitpoints, position } = obj;
        const h = HitTotal.fromObject(hitpoints);
        const d = Metadata.fromObject(data);
        const other = new Actor(d, h);
        if (position) {
            const p = Vector.fromObject(position);
            if (!p.equals(0)) other.onload.then((o) => o.Mover.apply(p));
            else console.warn(`[${typeString(this)}]: Invalid position from object for player ${other.Metadata.Profile.name} (${other.id})`);
        }
        return other;
    }
    #Aimer;
    #Mover;
    #Puppet;
    #Metadata;
    #HitTotal;
    #originalStyling = {};
    constructor (metadata, hittotal) {
        super();
        this.#Metadata = metadata;
        this.#HitTotal = hittotal;
        this.#saveStyling();
        this.onload.then(() => {
            this.applyStyling();
            this.#Puppet = new Puppet(this.Metadata.Model.body, this.Metadata.Model.barrel);
            this.#Aimer = new Aimer(this.Puppet, this.Puppet.width * 3);
            this.#Mover = new Mover(this.Puppet);
            this.Mover.offsetY = -(this.Puppet.offset.body.y / 10);
            this.Mover.climbHeight = this.Puppet.height / 2
        });
    }

    #saveStyling () {
        const styling = this.#originalStyling;
        styling.barOffset = this.HitTotal.barOffset.clone();
    }

    applyStyling (cursor) {
        const original = this.#originalStyling;
        const { Profile, Model } = this.Metadata;
        Model.body.width = 50;
        Model.barrel.scale.apply(Model.body.scale);
        Profile.fontSize = 18;
        const nameWidth = Profile.getNameWidth(cursor);
        const profileLinePadding = 5;
        Profile.fontColor.apply(255, 255, 255);
        Profile.avatar.width = 25;
        Profile.nameOffset.x = ((nameWidth + Profile.avatar.width) / 2) - (nameWidth / 2);
        Profile.avatarOffset.x = Profile.nameOffset.x - (nameWidth / 2) - (25 / 2) - profileLinePadding;
        Profile.avatarOffset.y = Profile.nameOffset.y = Model.body.height * 2.6;

        this.HitTotal.barOffset.y = original.barOffset.y + Model.body.height * 2;
        this.HitTotal.barHeight = 8;
        this.HitTotal.barWidth = Model.body.width;
    }
    drawOverlay (cursor, hideProfile = false) {
        const { Metadata, Puppet, HitTotal, isDead } = this;
        cursor.save();
        if (isDead) {
            cursor.filter = "grayscale(100%)";
            Metadata.Profile.fontColor.apply(100, 100, 100); // [!] inefficient
        }
        if (hideProfile)
            Metadata.Profile.draw(cursor, Puppet.relativePosition);
        HitTotal.draw(cursor, Puppet.relativePosition);
        cursor.restore();
    }
    toJSON () {
        // [!] don't store aiming angle- save on backend storage, don't think anyone will notice/care... - KT
        const payload = {
            data: this.Metadata.toJSON(),
            hitpoints: this.HitTotal.toJSON(),
        };
        if (this.ready)
            payload.position = this.Puppet.position.toJSON();
        return payload;
    }
    getCollider () {
        const { Puppet, Mover } = this;
        const collider = Puppet.getHitbox().Polygon();
        collider.userData.collision = Properties.PLAYER | Properties.ENTER;
        collider.userData.position = Puppet.position.round(2, true).toJSON();
        collider.userData.rotation = Puppet.rotation.body;
        collider.userData.heightOffset = Puppet.height + Mover.offsetY;
        return collider;
    }

    get isActor () { return true }
    get onload () { return this.Metadata.onload }
    get ready () { return this.Metadata.ready }
    get source () { return this.Metadata.source }
    get id () { return this.Metadata.Profile.userid }
    get Metadata () { return this.#Metadata }
    get HitTotal () { return this.#HitTotal }
    get Puppet () { return this.#Puppet }
    get Aimer () { return this.#Aimer }
    get Mover () { return this.#Mover }
}
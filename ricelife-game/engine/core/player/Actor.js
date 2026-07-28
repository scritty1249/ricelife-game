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
    #stylingApplied = false;
    constructor (metadata, hittotal) {
        super();
        this.#Metadata = metadata;
        this.#HitTotal = hittotal;
        this.#saveStyling();
        this.onload.then(() => {
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
        if (!cursor?.isCanvas2DContextCursor) return;
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
        this.#stylingApplied = true;
    }
    drawOverlay (cursor, hideProfile = false) {
        const { Metadata, Puppet, HitTotal, isDead } = this;
        if (!this.#stylingApplied) this.applyStyling(cursor);
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
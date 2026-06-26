import { Vector, Color } from "../geometry/geometry.js";
import { LoadImage } from "../animate/animate.js";
import { TrackableObject } from "../utils/utils.js";
import { TankController, AimController, MovementController } from "../controller/controller.js";
import * as HitPointTypes from "./types.js";

// wrapper for anything player related. includes controllers
export class Player extends TrackableObject  {
    #data;
    #mover;
    #aimer;
    #tank;
    #isLoaded = false;
    constructor (data) {
        super();
        this.#data = data;
    }

    async load (terrain) {
        if (this.#isLoaded) throw new Error(`[${this.constructor.name}]: Failed to load - already loaded`);
        await this.data.onload;
        const { body, barrel } = this.data.model;
        this.#tank = new TankController(body, barrel, new Vector());
        this.#aimer = new AimController(this.tank, this.tank.width * 3);
        this.#mover = new MovementController(terrain, this.tank,  -(this.tank.offset.body.y / 10));
        this.#isLoaded = true;
        return this; // for chaining
    }

    get isPlayer () { return true }
    get data () { return this.#data }
    get tank () { return this.#tank }
    get aimer () { return this.#aimer }
    get mover () { return this.#mover }
}

// wraps all player related data
export class PlayerData {
    static fromObject (obj, team = 1) {
        const { profile, hitpoints, model } = obj;
        const suffix = team > 0
            ? "ally"
            : team < 0
                ? "enemy"
                : "self";
        const m = new PlayerModel(`${model}_${suffix}`);
        const p = PlayerProfile.fromObject(profile);
        const h = HitPoints.fromObject(hitpoints);
        return new PlayerData(m, h, p, team);
    }
    #team = 1; // 0 - self, 1 - ally, -1 - enemy
    #profile;
    #model;
    #hitpoints;
    constructor (model, hitpoints, profile, team = 1) {
        this.#profile = profile; // PlayerProfile
        this.#model = model; // PlayerModel
        this.#team = team;
        this.#hitpoints = new HitPoints(new HitPointTypes.Health(100), new HitPointTypes.Shield(20));
    }

    toJSON () {
        return {
            profile: this.profile.toJSON(),
            hitpoints: this.hitpoints.toJSON(),
            model: this.model.type
        };
    }

    get isPlayerData () { return true }
    get onload () { return Promise.all([this.profile.onload, this.model.onload]).then(() => this) }
    get profile () { return this.#profile }
    get model () { return this.#model }
    get team () { return this.#team }
    get hitpoints () { return this.#hitpoints }
}

// discord profile related data (icon, display name)
// is responsible for drawing
export class PlayerProfile {
    static fromObject (obj) {
        const img = new LoadImage(obj.avatar);
        const other = new PlayerProfile(obj.name, img);
        other.fontFamily = obj.fontFamily;
        return other;
    }
    #name;
    #avatar;
    #fontSize = 12;
    #fontFamily = "serif";
    #fontColor = new Color();
    #avatarOffset = new Vector();
    #nameOffset = new Vector();
    
    // String, LoadedImage
    constructor (name, avatar) {
        this.#name = name.trim();
        this.#avatar = avatar;
    }

    draw (cursor, position) {
        this.drawName(cursor, position);
        this.drawAvatar(cursor, position);
    }
    drawName (cursor, position) {
        cursor.save();
        cursor.fillStyle = this.fontColor.toString();
        cursor.font = this.font;
        cursor.fillText(this.name, position.add(this.nameOffset));
        cursor.restore();
    }
    drawAvatar (cursor, position) {
        const offset = this.avatarOffset;
        this.avatar.draw(cursor, position.x + offset.x, position.y + offset.y);
    }
    toJSON () {
        return {
            name: this.name,
            avatar: this.avatar.img.src,
            fontFamily: this.fontFamily
        }
    }

    get isPlayerProfile () { return true }
    get name () { return this.#name }
    get avatar () { return this.#avatar }
    get onload () { return this.avatar.onload.then(() => this) }
    get nameOffset () { return this.#nameOffset }
    get avatarOffset () { return this.#avatarOffset }
    get fontColor () { return this.#fontColor }
    get fontSize () { return this.#fontSize }
    set fontSize (pixels) { return (this.#fontSize = pixels) }
    get fontFamily () { return this.#fontFamily }
    set fontFamily (font) { return (this.#fontFamily = font) }
    get font () { return `${this.fontSize}px ${this.fontFamily}` }
}

// wraos player model (image) data. Is not responsible for drawing model
export class PlayerModel {
    static SOURCE_TABLE = {};
    static loadSource (key) {
        const list = PlayerModel.SOURCE_TABLE;
        const body = new LoadImage(list[key].body);
        const barrel = new LoadImage(list[key].barrel)
        list[key] = { body, barrel };
    }
    static getSource (key) {
        return PlayerModel.SOURCE_TABLE[key];
    }
    static sourceLoaded (key) {
        return PlayerModel.getSource(key).body?.isLoadImage;
    }
    static sourceExists (key) {
        return key in PlayerModel.SOURCE_TABLE;
    }
    #type;
    #body;
    #barrel;
    // LoadedImage, LoadedImage
    // parameters should be passed in by reference
    constructor (type, width = 50) {
        if (!PlayerModel.sourceExists(type)) throw new Error(`[${this.constructor.name}]: Model type ${type} does not exist in source table ${Object.keys(PlayerModel.SOURCE_TABLE)?.toString()}`);
        if (!PlayerModel.sourceLoaded(type)) PlayerModel.loadSource(type);
        const { body, barrel } = PlayerModel.getSource(type);
        this.#type = type;
        this.#body = body.clone(false);
        this.#barrel = barrel.clone(false);
        this.onload.then(() => {
            this.#body.width = width;
            this.#barrel.scale.apply(this.#body.scale);
        });
    }

    get isPlayerModel () { return true }
    get body () { return this.#body }
    get barrel () { return this.#barrel }
    get type () { return this.#type }
    get onload () { return Promise.all([this.body.onlaod, this.barrel.onload]).then(() => this) }
    get width () { return this.body.width }
    set width (pixels) {
        this.body.width = pixels;
        this.barrel.scale.apply(this.body.scale);
        return pixels;
    }
    get height () { return this.body.height }
    set height (pixels) {
        this.body.height = pixels;
        this.barrel.scale.apply(this.body.scale);
        return pixels;
    }
}

// assigned to each player
class HitPoints {
    static fromObject (obj) {
        const layers = Array.from(obj, (o) => HitPointTypes[o.type].fromObject(o));
        return new HitPoints(...layers);
    }
    #layers = new Array();
    constructor (bottomLayer, ...layers) {
        this.push(bottomLayer, ...layers);
    }

    // returns the remaining damage, if any, after all layers have dropped to zero amount.
    // expects amount to be positive
    damage (amount) {
        let rollover = amount;
        while (rollover > 0 && !this.currentLayer.isZero)
            rollover += this.currentLayer.update(-rollover);
        return rollover;
    }
    push (...layers) {
        if (layers.some((layer) => !layer?.isHitAmount)) throw new Error(`[${this.constructor.name}]: Layers must be of type HitAmount`);
        this.#layers.push(...layers);
    }
    pop () { 
        return this.#layers.pop();
    }
    insert (index, ...layers) {
        if (layers.some((layer) => !layer?.isHitAmount)) throw new Error(`[${this.constructor.name}]: Layers must be of type HitAmount`);
        this.#layers.splice(index, 0, ...layers);
    }
    remove (index, deleteCount = 1) {
        this.#layers.splice(index, deleteCount);
    }
    layer (index) {
        return this.#layers.at(index);
    }
    toJSON () {
        return this.#layers.map((layer) => layer.toJSON());
    }

    get isHitPoints () { return true }
    get isZero () { return this.baseLayer.isZero } // if base layer is zero, player is dead.
    get baseLayer () { return this.#layers[0] }
    get length () { return this.#layers.length }
    get currentLayer () { return this.#layers[this.currentLayerIndex] }
    get currentLayerIndex () {
        for (let i = this.#layers.length - 1; i >= 0; i--)
            if (!this.#layers[i].isZero) return i;
        return 0;
    }
}
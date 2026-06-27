import { TrackableObject } from "../utils/utils.js";
import { Vector } from "../geometry/geometry.js";
import { TankController, AimController, MovementController } from "../controller/controller.js";

// wrapper for anything player related. includes controllers
export class PlayerInstance extends TrackableObject  {
    #data;
    #mover;
    #aimer;
    #tank;
    #isLoaded = false;
    constructor (data) {
        super();
        this.#data = data;
    }

    #applyStyling () {
        const { profile, model } = this.data;
        model.body.width = 50;
        model.barrel.scale.apply(model.body.scale);
        profile.avatar.width = 25;
        profile.nameOffset.y = model.body.height * 1.5;
        profile.avatarOffset.y = model.body.height * 2.4;
        profile.fontColor.apply(255, 255, 255);
    }

    async load (terrain) {
        if (this.#isLoaded) throw new Error(`[${this.constructor.name}]: Failed to load - already loaded`);
        await this.data.onload;
        this.#applyStyling();
        this.#tank = new TankController(this.data.model.body, this.data.model.barrel, new Vector());
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
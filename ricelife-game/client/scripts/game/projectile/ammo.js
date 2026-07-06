import { TrackableObject } from "../utils/utils.js";
import { Color, BoundingBox, Vector } from "../geometry/geometry.js";
import { Properties } from "./collision/collision.js";
import { MultiShotStage } from "./stages.js";
import { GravityController } from "../controller/controller.js";

// bundle tracer to be seperated from Ammos
class AmmoTracer {
    #stages = new Array(); // 2D array, contains sequence of MultShotStage tracers (Paths)
    #color = new Color(255, 255, 255, .35);
    lineDash = new Array(10, 20);
    constructor (stages) {
        for (const stage of stages) {
            if (!stage?.isMultiShotStage) throw new Error(`[${this.constructor.name}]: Invalid parameter array item, expected MultiShotStage, got ${typeof stage}`);
            this.#stages.push(stage.tracer); // stage.tracer should be an Array of Paths
        }
    }

    draw (cursor) {
        cursor.save();
        cursor.setLineDash(this.lineDash);
        cursor.strokeStyle = this.color.toString();
        for (const stageTrace of this.#stages)
            for (const trace of stageTrace)
                trace.draw(cursor, true);
        cursor.restore();
    }

    get isAmmoTracer () { return true }
    get color () { return this.#color }
}

// supports a sequence of shot or multishot stages
export class Ammo extends TrackableObject {
    static SFX = {
        null: () => {}
    };
    #time = 0;
    #colliders;
    #currentStage;
    #isStarted = false;
    #stages = new Array();
    #stageIdx = 0;
    #blasts = new Array();
    constructor (colliders = [], stages = []) {
        super();
        this.#colliders = colliders;
        for (const stage of stages) {
            this.#stages.push(stage);
        }
        this.#currentStage = this.#stages[0];
    }

    draw (cursor) {
        if (!this.isFinished) {
            this.#currentStage.drawGlow(cursor);
            this.#currentStage.drawBody(cursor);
        }
    }
    nextStage () {
        this.#currentStage = this.#stages[++this.#stageIdx];
        this.#currentStage.blastTimeOffset += this.time;
    }
    update (seconds) {
        if (!this.#isStarted) this.#isStarted = true;
        this.time += seconds;
        this.#currentStage?.update(seconds);
        if (this.#currentStage?.isFinished) {
            if (this.hasNextStage) this.nextStage();
            else this.#currentStage = undefined;
        }
    }
    // create multishot stage by default
    newStage (delay = 0) {
        const stage = new MultiShotStage(delay, this.blasts, this.colliders, this.constructor.SFX);
        this.#stages.push(stage);
        if (this.#stageIdx === 0 && this.#currentStage === undefined) this.#currentStage = this.#stages[this.#stageIdx];
        return stage;
    }
    getBoundingBox (merge = true) {
        return this.currentStage?.getBoundingBox?.(merge) || new BoundingBox();
    }
    clone (deep = false) {
        const stages = [];
        for (const stage of this.#stages) stages.push(stage.clone(deep));
        const ammo = new Ammo(this.colliders, stages);
        return ammo;
    }
    getLegend (decode = true) {
        return this.stages.map((stage) => stage.getLegend(decode));
    }
    setLegend (legend) { // expects an decoded legend 
        try {
            const stages = this.stages;
            for (let i = 0; i < stages.length; i++)
                stages[i].setLegend(legend[i]);
        } catch (error) {
            console.error(`[${this.constructor.name}]: Error parsing legend arrays`);
            throw error;
        }
    }
    getTracer () { return new AmmoTracer(this.stages) }

    get isAmmo () { return true }
    get colliders () { return this.#colliders }
    get blasts () { return this.#blasts }
    get stages () { return this.#stages }
    get currentStage () { return this.#currentStage }
    get hasNextStage () { return this.#stageIdx + 1 < this.#stages.length }
    get isStarted () { return this.#isStarted }
    get isFinished () { return this.isStarted && this.#currentStage === undefined }
    get time () { return this.#time }
    set time (value) { return (this.#time = value) }
    set pushBlasts (value) { this.stages.forEach((stage) => stage.pushBlasts = value); return value }
}

export function traceAmmo (
    ammoType, // constructor
    origin, // vector
    angle, // radians
    power, // Float (0-1)
    resolution, // Integer
    increment, // Float
    limit, // Float
    collisions // [...Polygon]
) {
    const ammo = new ammoType(origin, angle, power, resolution);
    for (const collisionPoly of collisions) ammo.colliders.push(collisionPoly);
    ammo.pushBlasts = true;
    const terrainPoly = ammo.colliders.find(({userData}) => userData.collision & Properties.TERRAIN);
    const originalHoleCount = terrainPoly.holes.length;
    const playerPolys = ammo.colliders.filter(({userData}) => userData.collision & Properties.PLAYER);
    playerPolys.forEach(({userData}) => {
        userData.position = Vector.fromObject(userData.position);
    });
    const result = { finished: false, time: limit };
    let blastsCount;
    while (ammo.time < limit && !result.finished) {
        blastsCount = ammo.blasts.length;
        // run the trace
        ammo.update(increment);
        // check if done
        if (ammo.isFinished) {
            result.time = ammo.time;
            result.finished = true;
            break;
        }
        // update player hitboxes
        // [!] does not track if player dies. Need to do that - KT
        if (playerPolys.length && ammo.blasts.length !== blastsCount) { // why would there ever be less?
            const newBlasts = ammo.blasts.slice(blastsCount);
            for (const player of playerPolys) {
                if (!newBlasts.some((b) => b.shape.isIntersecting(player))) continue;
                // update positioning - account for "falling"
                const { position, rotation, heightOffset } = player.userData;
                const hit = GravityController.computePosition(position, heightOffset, terrainPoly);
                if (hit) {
                    const { angle, point } = hit;
                    const offset = point.sub(position);
                    player.path.forEach((pt) => pt
                        .pivot(angle - rotation, position, true)
                        .add(offset, true));
                    position.add(offset, true);
                    player.userData.rotation = angle;
                }
            }
        }
    }
    result.legend = ammo.getLegend(); // [!] no need to pass as transfer, we shouldn't have a large amount of collisions
    result.blasts = ammo.blasts.map((blast) => blast.decode());
    if (terrainPoly.holes.length > originalHoleCount) terrainPoly.holes.splice(originalHoleCount, terrainPoly.holes.length - originalHoleCount);
    return result;
}
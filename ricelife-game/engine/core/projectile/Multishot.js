import { Shot } from "./Shot.js";
import { typeString } from "../utils/logging.js";
import { TrackableObject } from "../utils/tracking/TrackableObject.js";

// Multiple shots at once
export class Multishot extends TrackableObject {
    #shots = new Array();
    #blasts;
    #collisionCallback; // <bound to This> ([...{polygon: Polygon, overlap: Path}]) => undefined
    #time = 0; // need to track a global time, seperate from each individal shot
    #blastTimeOffset = 0; // offset time when creating new Blasts
    #delayTime; // don't start updating shots until this duration has passed
    #colliders; // list of polygons that shots can collide with
    #isStarted = false; // trip this flag once we start updating shots, never set again to prevent tracking errors
    #finishedPromise = Promise.withResolvers();
    #isResolved = false;
    #sfxCallback;
    #launchCallback;
    #displayBoundingBox;
    constructor (delay = 0, blastsReference = [], collisionsReference = [], sfxCallbackReference = {}) {
        super();
        this.#delayTime = delay;
        this.#blasts = blastsReference;
        this.#colliders = collisionsReference;
        this.#sfxCallback = sfxCallbackReference;
    }

    #updateStages (seconds) {
        for (const stage of this.shots)
            stage.update(seconds);
    }

    update (seconds) {
        try {
            if (!this.#isStarted) this.#isStarted = true;
            {
                const isDelayed = this.time <= this.delay;
                this.time += seconds;
                if (isDelayed) return;
            }
            this.#updateStages(seconds);
            if (!this.#isResolved && this.isFinished) {
                this.#isResolved = true;
                this.#finishedPromise.resolve();
            }
        } catch (error) {
            this.#finishedPromise.reject(error);
            throw error;
        }
    }
    draw (cursor) {
        for (const stage of this.shots) stage.draw(cursor); // each stage knows whether to draw itself or not
    }
    drawGlow (cursor) {
        for (const stage of this.shots) stage.drawGlow(cursor);
    }
    drawBody (cursor) {
        for (const stage of this.shots) stage.drawBody(cursor);
    }
    // delay is amount of time before starting to update the shot
    newStage (shot, delay = 0) {
        const stage = new Shot(shot, delay, this.blasts, this.colliders, this.sfxCallback);
        stage.blastTimeOffset = this.blastTimeOffset;
        stage.launchCallback = this.launchCallback;
        stage.displayBoundingBox = this.displayBoundingBox;
        this.#shots.push(stage);
        return stage;
    }
    // creates a fresh instance with the same ShotStages, callbacks, and delay. References and blast time offset are not copied.
    clone (deep = false, blastsReference = [], collisionsReference = [], sfxCallbackReference = {}) {
        const multishot = new Multishot(this.delay, blastsReference, collisionsReference, sfxCallbackReference);
        for (const stage of this.shots) {
            const newStage = multishot.newStage(stage.shot.clone(deep), stage.delay);
            newStage.collisionCallback = stage.collisionCallback;
        }
        return multishot;
    }
    getLegend (encode = true) {
        return this.shots
            .map((stage) => stage.getLegend(encode))
            .map(encode
                ? ({duration, collisions}) => [duration, collisions]
                : (legend) => legend);
    }
    setLegend (legend) {
        try {
            const shots = this.shots;
            for (let i = 0; i < this.size; i++)
                shots[i].setLegend(legend[i]);
        } catch (error) {
            console.error(`[${typeString(this)}]: Error parsing legend array`);
            throw error;
        }
    }
    getBoundingBox (merge = true, includeStopped = true, includeFx = false) {
        const bboxes = (includeStopped ? this.shots : this.shots.filter(({projectile}) => !projectile.isStopped))
            .map(({projectile}) => projectile.getBoundingBox(includeFx));
        if (!merge) return bboxes;
        if (!bboxes.length) return new BoundingBox();
        const bbox = bboxes.shift();
        for (const bb of bboxes)
            bbox.add(bb, true);
        return bbox;
    }

    get isMultishot () { return true }
    get size () { return this.#shots.length }
    get blasts () { return this.#blasts }
    get colliders () { return this.#colliders } 
    get isFinished () { return this.size === 0 || this.shots.every(({isFinished}) => isFinished) }
    get isStarted () { return this.#isStarted } // [!] stage tracking- may be redundant
    get isInsideDisplay () { return this.shots.some(({isInsideDisplay}) => isInsideDisplay) } // [!] will return shot as in-bounds if a display bbox is not set
    get delay () { return this.#delayTime }
    get shots () { return this.#shots }
    get onend () { return this.#finishedPromise.promise }
    get time () { return this.#time }
    set time (value) { return (this.#time = value) }
    get blastTimeOffset () { return this.#blastTimeOffset }
    set blastTimeOffset (value) { return (this.#blastTimeOffset = value) }
    get sfxCallback () { return this.#sfxCallback }
    get launchCallback () { return this.#launchCallback }
    set launchCallback (callbackFn) {
        for (const stage of this.shots)
            stage.launchCallback = callbackFn;
        return (this.#launchCallback = callbackFn);
    }
    get displayBoundingBox () { return this.#displayBoundingBox }
    set displayBoundingBox (bbox) {
        for (const stage of this.shots)
            stage.displayBoundingBox = bbox;
        return (this.#displayBoundingBox = bbox);
    }
    set applyDestruction (value) { this.shots.forEach((stage) => stage.applyDestruction = value); return value }
    get tracer () { return this.shots.map(({tracer}) => tracer) }
}
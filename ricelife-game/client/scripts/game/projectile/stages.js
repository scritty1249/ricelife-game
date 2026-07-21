import { TrackableObject, floatEqual } from "../utils/utils.js";
import { Vector, Path, Ray, BoundingBox } from "../geometry/geometry.js";
import { Properties, getSegmentCollision } from "./collision/collision.js";

// Shot that supports multiple stages. Only supports ONE shot at a time
export class ShotStage extends TrackableObject {
    static getCircleCollision (position, projection, colliders = []) {
        if (!colliders?.length) return;
        if (!projection?.shape?.isCircle) throw new Error(`Invalid projection - shape must be a Circle`);
        else if (projection.shape.isEllipse) throw new Error(`Invalid projection - shape cannot be elliptical`);
        if (colliders.some(({isPolygon}) => !isPolygon)) throw new Error(`Invalid collider(s) - Polygon expected`);

        const radius = projection.shape.radii.max();
        const angles = [];
        let collision;
        let flags = 0;
        let minCoeff = 1;
        for (let cidx = 0; cidx < colliders.length; cidx++) {
            const collider = colliders[cidx];
            if (!collider.getBoundingBox().isIntersecting(projection.traversalArea)) continue;
            // getting collision flags
            const collisionFlags = collider.userData?.collision || 0;
            const allowEnter = collisionFlags & Properties.ENTER;
            const allowExit = collisionFlags & Properties.EXIT;

            const edges = collider.edges;
            for (let eidx = 0; eidx < edges.length; eidx++) {
                const edge = edges[eidx];
                const clockwise = edge.isClockwise;
                const iter = edge.pairs();
                for (let next = iter.next(); !next.done; next = iter.next()) {
                    const start = next.value;
                    const end = iter.next().value;
                    const hit = getSegmentCollision(
                        position, projection.position,
                        start, end,
                        radius, clockwise, projection.delta
                    );
                    if (hit && ((hit.entering && allowEnter) || (!hit.entering && allowExit))) {
                        if (hit.projectedCoeff <= minCoeff) {
                            minCoeff = hit.projectedCoeff;
                            collision = hit;
                            flags = collisionFlags;
                            angles.splice(0, angles.length, hit.normal);
                        } else if (floatEqual(hit.projectedCoeff, minCoeff)) {
                            angles.push(hit.normal);
                        }
                    }
                }
            }
        }
        if (collision) {
            return {
                position: collision.position,
                point: collision.point,
                normal: Vector.average(angles).normalize(true),
                flags: flags 
            };
        }        
    }
    #shot;
    #blasts;
    #time = 0; // global time, seperate from Shot time
    #delayTime; // don't start updating shot until this duration has passed
    #collisionCallback; // <bound to This> (point (contact point), normal (of colliding surface), collisionFlags) => undefined
    #updateCallback; // <bound to This> () => undefined
    #launchCallback; // <bound to This> () => undefined
    #colliders; // list of polygons that can be collided with
    #isFinished = false; // trip this flag once projectile stops moving, never set again to prevent overlapping stages
    #isStarted = false; // trip this flag once we start updating projectile, never set again to prevent tracking errors
    #applyDestruction = false; // push new blasts to collider polygon holes
    #blastTimeOffset = 0; // offset time when creating new Blasts
    #finishedPromise = Promise.withResolvers();
    #legend; // when set, ShotStage will skip all collision checks and follow based on this
    #record = { // records data to be exported
        collisions: [],
        duration: 0
    };
    #sfxCallback;
    #tracer = new Path();
    #hasLaunched = false;
    #playLaunchCallback = true;
    #displayBoundingBox; // optimization- when set, will only draw shot if bounding box intersects with it
    constructor (shot, delay = 0, blastsReference = [], collisionsReference = [], sfxCallbackReference = {}) {
        if (!shot?.isShot) throw new Error(`[${this.constructor.name}]: Invalid parameter - expected Shot, got ${typeof shot}`);
        super();
        this.#shot = shot;
        this.#delayTime = delay;
        this.#blasts = blastsReference; // by reference
        this.#colliders = collisionsReference; // by reference
        this.#sfxCallback = sfxCallbackReference; // by reference
    }

    #projectToCollision (seconds = 1) {
        const { shot, blasts, colliders } = this;
        const projection = shot.project(seconds);
        // Approximate if any colliders lie between current state and given projection
        const nearbyColliders = colliders.filter((collider) =>
            projection.traversalArea.isIntersecting(collider.getBoundingBox()));
        let collision;
        if (nearbyColliders.length) {
            if (shot.shape.isCircle && !shot.shape.isEllipse)
                collision = ShotStage.getCircleCollision(shot.position, projection, colliders);
            else
                throw new Error(`[${this.constructor.name}]: Cannot compute collision for non-Circle shot shape`);
        }
        if (collision) {
            shot.applyPosition(collision.position);
            this.applyCollision(collision.point, collision.normal, collision.flags);
            return;
        }
        shot.update(seconds);
    }
    #setFinished () { // [!] does not check if already finished. Caller is responsible for making sure this is only used once
        this.#isFinished = true;
        this.#finishedPromise.resolve();
    }
    #trackUpdate () { // [!] poorly named. Tracks data during update() calls
        this.#record.duration = this.time;
        this.tracer.push(this.shot.position.clone());
    }

    // point is collision/contact point
    applyCollision (point, normal, collisionFlags) {
        const { time, shot } = this;
        const position = shot.position.clone();
        const velocity = shot.current.velocity.clone();
        const collision = {
            time,
            collisionFlags,
            position,
            point,
            velocity,
            normal,
            resultVelocity: undefined // velocity after collision. Mainly for debugging
        }
        this.#record.collisions.push(collision);
        this.collisionCallback?.(point, normal, collisionFlags);
        collision.resultVelocity = shot.current.velocity.clone();
    }
    update (seconds) {
        try {
            if (!this.#isStarted) this.#isStarted = true;
            if (this.time <= this.delay) {
                this.time += seconds;
                return;   
            } else if (!this.#hasLaunched) {
                if (this.playLaunchCallback)
                    this.launchCallback?.();
                this.#hasLaunched = true;
            }
            const { shot } = this;
            if (this.isTracing) {
                const { shot } = this;
                this.time += seconds;
                if (!this.#isFinished) {
                    this.#projectToCollision(seconds);
                    this.updateCallback?.();
                    this.#trackUpdate();
                    if (!this.#isFinished && shot.isStopped)
                        this.#setFinished();
                }
            } else {
                const legend = this.#legend;
                this.time += seconds;
                if (legend.collisions.length > 0
                    && this.time >= legend.collisions[0].time
                ) {
                    const { time, collisionFlags, position, point, velocity, normal } = legend.collisions.shift();
                    shot.applyPosition(position);
                    shot.current.velocity.apply(velocity);
                    this.applyCollision(point, normal, collisionFlags);
                } else {
                    shot.update(seconds);
                }
                this.updateCallback?.();
                this.#trackUpdate();
                if (!this.#isFinished && this.time >= legend.duration)
                    this.#setFinished();
            }
        } catch (error) {
            this.#finishedPromise.reject(error);
            throw error;
        }
    }
    draw (cursor) {
        if (!this.isInsideDisplay) return;
        const { isStarted, isFinished, shot, delay, time } = this;
        if (isStarted && !isFinished && time > delay) shot.draw(cursor);
    }
    drawGlow (cursor) {
        if (!this.isInsideDisplay) return;
        const { isStarted, isFinished, shot, delay, time } = this;
        if (isStarted && !isFinished && time > delay) {
            shot.drawTailGlow(cursor);
            shot.drawMainGlow(cursor);
        }
    }
    drawBody (cursor) {
        if (!this.isInsideDisplay) return;
        const { isStarted, isFinished, shot, delay, time } = this;
        if (isStarted && !isFinished && time > delay) {
            shot.drawTail(cursor);
            shot.drawShot(cursor);
        }
    }
    applyBlast (blast) {
        const hitbox = blast.clone(true);
        hitbox.shape.transformation.offset.add(this.shot.position, true);
        hitbox.shape.applyTransformation();
        hitbox.delay += this.time + this.blastTimeOffset;
        this.blasts.push(hitbox);
        if (this.applyDestruction) {
            for (const collider of this.colliders) {
                if ((collider.userData.collision & Properties.DESTRUCTION)
                    && collider.getBoundingBox().isIntersecting(hitbox.shape.getBoundingBox())
                ) {
                    const poly = hitbox.shape.Polygon(1);
                    if (poly.path.isClockwise) poly.path.points.reverse();
                    collider.holes.push(poly);
                }
            }
        }
        return hitbox; // for modifying, if needed
    }
    playSfx (sfxName) {
        if (this.isTracing) return;
        if (sfxName in this.sfxCallback) this.sfxCallback[sfxName]?.();
        else console.warn(`[${this.constructor.name}]: Unable to play SFX "${sfxName}" -  callback does not exist`);
    }
    getLegend (decode = true) {
        // clones and returns everything in record. The resulting object should be safely passable between worker threads
        const record = this.#legend || this.#record;
        const legend = {
            duration: record.duration,
            collisions: Array.from(record.collisions,
                decode
                    ? ({time, collisionFlags, position, point, velocity, normal, resultVelocity}) => [
                        time,
                        collisionFlags,
                        [position.x, position.y],
                        [point.x, point.y],
                        [velocity.x, velocity.y],
                        [normal.x, normal.y],
                        [resultVelocity.x, resultVelocity.y]
                    ]
                    : (collision) => collision
            )
        };
        return legend;
    }
    setLegend (legend) {
        try {
            this.#legend = {
                duration: legend[0],
                collisions: Array.from(legend[1],
                    ([time, collisionFlags, position, point, velocity, normal, resultVelocity]) => ({
                        time: time,
                        collisionFlags: collisionFlags,
                        position: new Vector(position[0], position[1]),
                        point: new Vector(point[0], point[1]),
                        velocity: new Vector(velocity[0], velocity[1]),
                        normal: new Vector(normal[0], normal[1]),
                        resultVelocity: new Vector(resultVelocity[0], resultVelocity[1])
                    }))
            };
        } catch (error) {
            console.error(`[${this.constructor.name}]: Error parsing legend object`);
            throw error;
        }
    }
    // creates a fresh instance with the same Shot, delay and callback. References and blast time offset are not copied.
    clone (deep = false, blastsReference = [], collisionsReference = []) {
        const stage = new ShotStage(this.shot.clone(deep), this.delay, blastsReference, collisionsReference);
        stage.collisionCallback = this.collisionCallback;
        return stage;
    }

    get isShotStage () { return true }
    get isFinished () { return this.#isFinished }
    get isStarted () { return this.#isStarted } // [!] stage tracking- may be redundant
    get isTracing () { return this.#legend === undefined }
    get isInsideDisplay () { // [!] will return shot as in-bounds if a display bbox is not set
        const { displayBoundingBox, shot } = this;
        if (!displayBoundingBox) return true;
        return displayBoundingBox.isIntersecting(shot.getBoundingBox(true));
    }
    get delay () { return this.#delayTime }
    get shot () { return this.#shot }
    get blasts () { return this.#blasts }
    get colliders () { return this.#colliders }
    get onend () { return this.#finishedPromise.promise }
    get time () { return this.#time }
    set time (value) { return (this.#time = value) }
    get blastTimeOffset () { return this.#blastTimeOffset }
    set blastTimeOffset (value) { return (this.#blastTimeOffset = value) }
    get collisionCallback () { return this.#collisionCallback }
    set collisionCallback (callbackFn) { return (this.#collisionCallback = callbackFn?.bind(this)) }
    get updateCallback () { return this.#updateCallback }
    set updateCallback (callbackFn) { return (this.#updateCallback = callbackFn?.bind(this)) }
    get sfxCallback () { return this.#sfxCallback }
    get launchCallback () { return this.#launchCallback }
    set launchCallback (callbackFn) { return (this.#launchCallback = callbackFn?.bind(this)) }
    get playLaunchCallback () { return this.#playLaunchCallback }
    set playLaunchCallback (bool) { return (this.#playLaunchCallback = bool) }
    get applyDestruction () { return this.#applyDestruction }
    set applyDestruction (value) { return (this.#applyDestruction = value) }
    get displayBoundingBox () { return this.#displayBoundingBox }
    set displayBoundingBox (bbox) { return (this.#displayBoundingBox = bbox) }
    get tracer () { return this.#tracer }
}

// Multiple shots at once
export class MultiShotStage extends TrackableObject {
    #shotStages = new Array();
    #blasts;
    #collisionCallback; // <bound to This> ([...{polygon: Polygon, overlap: Path}]) => undefined
    #time = 0; // need to track a global time, seperate from each individal shot
    #blastTimeOffset = 0; // offset time when creating new Blasts
    #delayTime; // don't start updating stages until this duration has passed
    #colliders; // list of polygons that stages can collide with
    #isStarted = false; // trip this flag once we start updating stages, never set again to prevent tracking errors
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
        for (const stage of this.stages)
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
        for (const stage of this.stages) stage.draw(cursor); // each stage knows whether to draw itself or not
    }
    drawGlow (cursor) {
        for (const stage of this.stages) stage.drawGlow(cursor);
    }
    drawBody (cursor) {
        for (const stage of this.stages) stage.drawBody(cursor);
    }
    // delay is amount of time before starting to update the shot
    newStage (shot, delay = 0) {
        const stage = new ShotStage(shot, delay, this.blasts, this.colliders, this.sfxCallback);
        stage.blastTimeOffset = this.blastTimeOffset;
        stage.launchCallback = this.launchCallback;
        stage.displayBoundingBox = this.displayBoundingBox;
        this.#shotStages.push(stage);
        return stage;
    }
    // creates a fresh instance with the same ShotStages, callbacks, and delay. References and blast time offset are not copied.
    clone (deep = false, blastsReference = [], collisionsReference = [], sfxCallbackReference = {}) {
        const multishot = new MultiShotStage(this.delay, blastsReference, collisionsReference, sfxCallbackReference);
        for (const stage of this.stages) {
            const newStage = multishot.newStage(stage.shot.clone(deep), stage.delay);
            newStage.collisionCallback = stage.collisionCallback;
        }
        return multishot;
    }
    getLegend (decode = true) {
        return this.stages
            .map((stage) => stage.getLegend(decode))
            .map(decode
                ? ({duration, collisions}) => [duration, collisions]
                : (legend) => legend);
    }
    setLegend (legend) {
        try {
            const stages = this.stages;
            for (let i = 0; i < this.size; i++)
                stages[i].setLegend(legend[i]);
        } catch (error) {
            console.error(`[${this.constructor.name}]: Error parsing legend array`);
            throw error;
        }
    }
    getBoundingBox (merge = true, includeStopped = true, includeFx = false) {
        const bboxes = (includeStopped ? this.stages : this.stages.filter(({shot}) => !shot.isStopped))
            .map(({shot}) => shot.getBoundingBox(includeFx));
        if (!merge) return bboxes;
        if (!bboxes.length) return new BoundingBox();
        const bbox = bboxes.shift();
        for (const bb of bboxes)
            bbox.add(bb, true);
        return bbox;
    }

    get isMultiShotStage () { return true }
    get size () { return this.#shotStages.length }
    get blasts () { return this.#blasts }
    get colliders () { return this.#colliders } 
    get isFinished () { return this.size === 0 || this.stages.every(({isFinished}) => isFinished) }
    get isStarted () { return this.#isStarted } // [!] stage tracking- may be redundant
    get isInsideDisplay () { return this.stages.some(({isInsideDisplay}) => isInsideDisplay) } // [!] will return shot as in-bounds if a display bbox is not set
    get delay () { return this.#delayTime }
    get stages () { return this.#shotStages }
    get onend () { return this.#finishedPromise.promise }
    get time () { return this.#time }
    set time (value) { return (this.#time = value) }
    get blastTimeOffset () { return this.#blastTimeOffset }
    set blastTimeOffset (value) { return (this.#blastTimeOffset = value) }
    get sfxCallback () { return this.#sfxCallback }
    get launchCallback () { return this.#launchCallback }
    set launchCallback (callbackFn) {
        for (const stage of this.stages)
            stage.launchCallback = callbackFn;
        return (this.#launchCallback = callbackFn);
    }
    get displayBoundingBox () { return this.#displayBoundingBox }
    set displayBoundingBox (bbox) {
        for (const stage of this.stages)
            stage.displayBoundingBox = bbox;
        return (this.#displayBoundingBox = bbox);
    }
    set applyDestruction (value) { this.stages.forEach((stage) => stage.applyDestruction = value); return value }
    get tracer () { return this.stages.map(({tracer}) => tracer) }
}

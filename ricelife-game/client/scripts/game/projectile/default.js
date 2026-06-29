import { TrackableObject, floatEqual, roundToPlace } from "../utils/utils.js";
import { Circle, Vector, Color, Path, Ray, BoundingBox } from "../geometry/geometry.js";
import * as Properties from "./properties.js";

export class Projectile extends TrackableObject {
    #tracer = new Path();
    #time = 0; // in seconds
    constructor (origin, velocity, acceleration, drag) {
        super();
        this.origin = origin.clone();
        this.drag = drag; // coefficient, values >1 will make projectiles move backwards infinitely
        this.acceleration = new Vector(acceleration);
        this.velocity = new Vector(velocity);
        this.current = {
            position: new Vector(origin),
            velocity: this.velocity.clone()
        };
    }

    get speed () {
        return Math.sqrt(this.current.velocity.pow(2).sum());
    }
    get position () {
        return this.current.position;
    }
    get isProjectile () {
        return true
    }
    updatePosition (seconds) {
        const position = this.current.position;
        const velocity = this.current.velocity;
        const acceleration = this.acceleration.clone();
        const v = velocity.mul(-this.drag * Math.sqrt(velocity.pow(2).sum()));
        if (velocity.x < 0)
            acceleration.x *= -1;
        else if (floatEqual(velocity.x, 0)) 
            acceleration.x *= 0;
        position.add(velocity.mul(seconds), true);
        velocity.add(acceleration.add(v).mul(seconds, true), true);
    }
    projectPosition (seconds) {
        const position = this.current.position;
        const velocity = this.current.velocity;
        const acceleration = this.acceleration.clone();
        const v = velocity.mul(-this.drag * Math.sqrt(velocity.pow(2).sum()));
        if (velocity.x < 0)
            acceleration.x *= -1;
        else if (floatEqual(velocity.x, 0)) 
            acceleration.x *= 0;
        return {
            position: position.add(velocity.mul(seconds)),
            velocity: velocity.add(acceleration.add(v).mul(seconds, true))
        };
    }
    update (seconds = 1) {
        this.#tracer.push(this.position.clone());
        if (!this.isStopped) this.updatePosition(seconds);
        this.#time += seconds;
        return this.position;
    }
    // simulate update
    project (seconds = 1) {
        if (this.isStopped) {
            return {
                position: this.position.clone(),
                velocity: this.current.velocity.clone(),
                time: this.time + seconds
            };
        } else {
            const projection = this.projectPosition(seconds);
            projection.time = this.time + seconds;
            return projection;
        }
    }
    reset () {
        this.current.position.apply(this.origin);
        this.current.velocity.apply(this.velocity);
        this.#time = 0;
    }

    get isProjectile () { return true }
    get tracer () { return this.#tracer }
    get time () { return this.#time }
    get isStopped () { return floatEqual(this.current.velocity.x, 0) && floatEqual(this.current.velocity.y, 0) }
    clone () { return new Projectile(this.origin, this.velocity, this.acceleration, this.drag) }
}

// projectile with a shape / hitbox
export class Shot extends Projectile {
    // configuration
    static tailLength = 10;
    static tailColor = new Color(255, 255, 255, .55);
    static glowRadius = 25;
    static glowResolution = 5;
    static glowColor = new Color(255, 0, 0, .4);
    static mainColor = new Color(255, 255, 255);
    // instance
    tailLength;
    tailColor;
    glowRadius;
    glowResolution;
    glowColor;
    mainColor;
    // other instance variables
    #shape;
    #tail = new Array();
    constructor (origin, velocity, acceleration, drag, shape) {
        super(origin, velocity, acceleration, drag);
        // config overrides
        this.tailLength = new.target.tailLength || Shot.tailLength;
        this.tailColor = (new.target.tailColor || Shot.tailColor).clone();
        this.glowRadius = new.target.glowRadius || Shot.glowRadius;
        this.glowResolution = new.target.glowResolution || Shot.glowResolution;
        this.glowColor = (new.target.glowColor || Shot.glowColor).clone();
        this.mainColor = (new.target.mainColor || Shot.mainColor).clone();
        this.#shape = shape;
    }

    #drawGlow (cursor, shape) {
        cursor.save();
        shape.draw(cursor);
        for (let i = this.glowResolution; i <= this.glowRadius; i += this.glowResolution) {
            const color = this.glowColor.clone();
            const factor = (1 - (i / this.glowRadius));
            color.a *= factor;
            cursor.strokeStyle = color.toString();
            cursor.lineWidth = i;
            cursor.stroke();
        }
        // mask out projectile space itself
        cursor.globalCompositeOperation = "destination-out";
        cursor.fill();
        cursor.globalCompositeOperation = "source-over";
        cursor.restore();
    }

    draw (cursor) {
        this.drawTailGlow(cursor);
        this.drawMainGlow(cursor);
        this.drawTail(cursor);
        this.drawShot(cursor);
    }
    drawShot (cursor) {
        cursor.save();
        cursor.fillStyle = this.mainColor.toString();
        this.shape.draw(cursor);
        cursor.fill();
        cursor.restore();
    }
    drawTail (cursor) {
        cursor.save();
        cursor.fillStyle = this.tailColor.toString();
        const minScale = 1 / this.tail.length;
        for (let i = 0; i < this.tail.length; i++) {
            const tail = this.tail[i];
            const scale = minScale + (i / this.tail.length);
            tail.transformation.save();
            tail.transformation.reset();
            tail.transformation.scale.apply(scale);
            tail.applyTransformation();
            tail.draw(cursor, true);
            tail.transformation.scale.apply(scale === 0 ? 0 : 1 / scale);
            tail.applyTransformation();
            tail.transformation.restore();
            cursor.fill();
        }
        cursor.restore();
    }
    drawMainGlow (cursor) {
        this.#drawGlow(cursor, this.shape);
    }
    drawTailGlow (cursor) {
        cursor.save();
        cursor.fillStyle = this.tailColor.toString();
        const minScale = 1 / this.tail.length;
        for (let i = 0; i < this.tail.length; i++) {
            const tail = this.tail[i];
            const scale = minScale + (i / this.tail.length);
            tail.transformation.save();
            tail.transformation.reset();
            tail.transformation.scale.apply(scale);
            tail.applyTransformation();
            this.#drawGlow(cursor, tail);
            tail.transformation.scale.apply(scale === 0 ? 0 : 1 / scale);
            tail.applyTransformation();
            tail.transformation.restore();
            cursor.fill();
        }
        cursor.restore();
    }
    applyPosition (vector) {
        this.shape.moveTo(vector);
        this.position.apply(vector);
    }
    update (seconds = 1) {
        if (this.tail.length >= this.tailLength) this.tail.shift();
        this.tail.push(this.shape.clone(true));
        this.shape.moveTo(super.update(seconds));
        return this.position; // for chaining
    }
    project (seconds = 1) {
        const projection = super.project(seconds);
        const shape = this.shape.clone(true);
        shape.moveTo(projection.position);
        projection.shape = shape;
        return projection;
    }
    collision (polygons = []) {
        const intersecting = [];
        const intersections = [];
        const shape = this.shape;
        for (const polygon of polygons)
            if (shape.isIntersecting(polygon)) intersecting.push(polygon);
        if (intersecting.length > 0) {
            const poly = shape.Polygon(1);
            for (const polygon of intersecting) {
                const overlap = poly.overlap(polygon, true);
                intersections.push({
                    polygon,
                    overlap,
                    normal: overlap.length >= 2 ? overlap.normal() : undefined
                });
            }
        } else return undefined; // signal nothing is intersecting
        return intersections;
    }
    clone (deep = false) { 
        const shot = new Shot(this.origin, this.velocity, this.acceleration, this.drag, this.shape.clone(deep));
        // copy configs
        shot.tailLength = this.tailLength;
        shot.tailColor = this.tailColor.clone();
        shot.glowRadius = this.glowRadius;
        shot.glowResolution = this.glowResolution;
        shot.glowColor = this.glowColor.clone();
        shot.mainColor = this.mainColor.clone();
        return shot;
    }

    get isShot () { return true }
    get shape () { return this.#shape }
    get tail () { return this.#tail }
}

// Shot that supports multiple stages. Only supports ONE shot at a time
export class ShotStage extends TrackableObject {
    #shot;
    #blasts;
    #time = 0; // global time, seperate from Shot time
    #delayTime; // don't start updating shot until this duration has passed
    #collisionCallback; // <bound to This> (point (contact point), normal (of colliding surface), collisionFlags) => undefined
    #updateCallback; // <bound to This> () => undefined
    #colliders; // list of polygons that can be collided with
    #isFinished = false; // trip this flag once projectile stops moving, never set again to prevent overlapping stages
    #isStarted = false; // trip this flag once we start updating projectile, never set again to prevent tracking errors
    #blastTimeOffset = 0; // offset time when creating new Blasts
    #finishedPromise = Promise.withResolvers();
    #legend; // when set, ShotStage will skip all collision checks and follow based on this
    #record = { // records data to be exported
        collisions: [],
        duration: 0
    };
    #sfxCallback;
    #tracer = new Path();
    constructor (shot, delay = 0, blastsReference = [], collisionsReference = [], sfxCallbackReference = {}) {
        if (!shot?.isShot) throw new Error(`[${this.constructor.name}]: Invalid parameter - expected Shot, got ${typeof shot}`);
        super();
        this.#shot = shot;
        this.#delayTime = delay;
        this.#blasts = blastsReference; // by reference
        this.#colliders = collisionsReference; // by reference
        this.#sfxCallback = sfxCallbackReference; // by reference
    }

    // Approximate if any collisions lie between current state and given projection
    #isCollisionAhead (projection) { // [!] poorly named
        const { shot, colliders } = this;
        const bbox = shot.shape.getBoundingBox()
            .merge(projection.shape.getBoundingBox());
        // [!] does not account for blasts
        return colliders.some((collider) => bbox.isIntersecting(collider.getBoundingBox()));
    }
    // project, update or set position at collision
    // [!] assumes the Shot shape is a non-elliptical circle
    #projectUpdate (seconds, resolution = 1) {
        const { shot, blasts, colliders } = this;
        const projection = shot.project(seconds);
        if (this.#isCollisionAhead(projection)) {
            // collect "front facing" coordinates
            const diff = projection.velocity.sub(shot.current.velocity);
            const distance = shot.position.distance(projection.position);
            const traversalBbox = shot.shape.getBoundingBox().merge(projection.shape.getBoundingBox(), false);
            const direction = diff.normalize();
            const origin = shot.shape.origin;
            const points = shot.shape.Polygon(resolution).path.points;
            const angles = [];
            const rays = [];
            const bbox = shot.shape.getBoundingBox();
            let hitPoint = undefined;
            let hitDistance = undefined;
            let clsnFlg = undefined; // [!] confusing and poor naming
            for (const point of points) {
                const dir = point.sub(origin).normalize(true);
                // only draw ray for front-facing points on the Shape
                if (direction.dot(dir) >= 0)
                    rays.push(Ray(point.clone(), direction.clone(), distance));
            }
            for (const collider of colliders) {
                // collision flags
                const collisionFlags = collider.userData?.collision || 0;
                const allowDestruction = collisionFlags & Properties.Collision.DESTRUCTION;
                const allowEnter = collisionFlags & Properties.Collision.ENTER;
                const allowExit = collisionFlags & Properties.Collision.EXIT;
                const allowEnterOnly = (collisionFlags & Properties.Collision.ANY) === Properties.Collision.ENTER;
                const allowExitOnly = (collisionFlags & Properties.Collision.ANY) === Properties.Collision.EXIT;
                // [!] temporary fix- assign blasts to polygon holes for raycasting, then remove after
                const colliderHoles = collider.holes;
                const originalHoleCount = colliderHoles.length;
                if (allowDestruction) {
                    for (const blast of blasts)
                        // push all existing blasts instead of only the intersecting ones. This way we don't force collider polygon to recompute edges every time shot moves between updates
                        colliderHoles.push(blast.shape.Polygon(resolution));
                }
                if (!traversalBbox.isIntersecting(collider.getBoundingBox())) continue;
                // do raycasts
                let doRaycast = true;
                for (let rayIdx = 0; rayIdx < rays.length && doRaycast; rayIdx++) {
                    const ray = rays[rayIdx]
                    const hits = collider.raycast(ray);
                    let angle = undefined;
                    for (const hit of hits) {
                        if ((allowEnterOnly && !hit.entering)
                            || (allowExitOnly && hit.entering)
                        ) {
                            hitDistance = undefined;
                            angle = undefined;
                            doRaycast = false;
                            break;
                        }
                        if (((allowExit && !hit.entering) || (allowEnter && hit.entering))
                            && (hitDistance === undefined || hit.distance < hitDistance)
                        ) {
                            hitPoint = hit.point;
                            hitDistance = hit.distance;
                            angle = hit.angle;
                            clsnFlg = collisionFlags;
                        }
                    }
                    if (angle !== undefined) angles.push(Vector.fromAngle(angle));
                }
                if (allowDestruction) {
                    // remove blasts / temp holes
                    colliderHoles.splice(originalHoleCount, blasts.length);
                }
            }
            if (hitDistance !== undefined) {
                const target = direction
                    .mul(hitDistance, true)
                    .add(origin, true);
                shot.applyPosition(target);
                this.applyCollision(hitPoint, Vector.average(angles).normalize(true), clsnFlg);
                return;
            }
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
            };
            const { shot } = this;
            const legend = this.#legend;
            if (legend === undefined) {
                const { shot } = this;
                this.time += seconds;
                this.#projectUpdate(seconds, 5);
                this.updateCallback?.();
                this.#trackUpdate();
                if (!this.#isFinished && shot.isStopped)
                    this.#setFinished();
            } else {
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
        const { isStarted, isFinished, shot, delay, time } = this;
        if (isStarted && !isFinished && time > delay) shot.draw(cursor);
    }
    applyBlast (blast) {
        const hitbox = blast.clone(true);
        hitbox.shape.transformation.offset.add(this.shot.position, true);
        hitbox.shape.applyTransformation();
        hitbox.delay += this.time + this.blastTimeOffset;
        this.blasts.push(hitbox);
        return hitbox; // for modifying, if needed
    }
    playSfx (sfxName) {
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
    // delay is amount of time before starting to update the shot
    newStage (shot, delay = 0) {
        const stage = new ShotStage(shot, delay, this.blasts, this.colliders, this.sfxCallback);
        stage.blastTimeOffset = this.blastTimeOffset;
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
    getBoundingBox (merge = true) {
        const bboxes = this.stages.map(({shot}) => shot.shape.getBoundingBox());
        if (!merge) return bboxes;
        const bbox = bboxes[0];
        for (const bb of bboxes.slice(1))
            bbox.merge(bb, true);
        return bbox;
    }

    get isMultiShotStage () { return true }
    get size () { return this.#shotStages.length }
    get blasts () { return this.#blasts }
    get colliders () { return this.#colliders } 
    get isFinished () { return this.size === 0 || this.stages.every(({isFinished}) => isFinished) }
    get isStarted () { return this.#isStarted } // [!] stage tracking- may be redundant
    get delay () { return this.#delayTime }
    get stages () { return this.#shotStages }
    get onend () { return this.#finishedPromise.promise }
    get time () { return this.#time }
    set time (value) { return (this.#time = value) }
    get blastTimeOffset () { return this.#blastTimeOffset }
    set blastTimeOffset (value) { return (this.#blastTimeOffset = value) }
    get sfxCallback () { return this.#sfxCallback }
    get tracer () { return this.stages.map(({tracer}) => tracer) }
}

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
        if (!this.isFinished) this.#currentStage.draw(cursor);
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
    // returns blasts over a given time
    trace (increment = 1/60, limit = 60, float64 = false) {
        const ammo = this.clone(true);
        const result = { finished: false, time: limit, state: ammo };
        while (ammo.time < limit && !result.finished) {
            // run the trace
            ammo.update(increment);
            if (ammo.isFinished) {
                result.time = ammo.time;
                result.finished = true;
            }
        }
        if (!result.finished) console.info(`[${this.constructor.name}]: Trace timed out`);
        result.legend = ammo.getLegend(); // [!] no need to pass as transfer, we shouldn't have a large amount of collisions
        result.blasts = float64
            ? ammo.blasts.map((blast) => blast.decode())
            : [...ammo.blasts]; // dereference
        return result;
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
}

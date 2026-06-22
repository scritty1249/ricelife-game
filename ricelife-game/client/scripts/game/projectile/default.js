import { TrackableObject, floatEqual, roundToPlace } from "../utils/utils.js";
import { Circle, Vector, Color, Path, Ray } from "../geometry/geometry.js";

export class Projectile extends TrackableObject {
    #tracer;
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
        {
            const tracer = new Path();
            const _originalDraw = tracer.draw;
            tracer.draw = function (cursor) {
                cursor.save();
                cursor.setLineDash([10, 20]);
                cursor.strokeStyle = "rgba(255, 255, 255, .35)";
                _originalDraw.call(this, cursor);
                cursor.restore();
            }
            this.#tracer = tracer;
        }
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
        velocity.add(acceleration.add(v).mul(seconds), true);
    }
    update (seconds = 1) {
        this.#tracer.push(this.position.clone());
        if (!this.isStopped) this.updatePosition(seconds);
        this.#time += seconds;
        return this.position;
    }
    reset () {
        this.current.position.apply(this.origin);
        this.current.velocity.apply(this.velocity);
        this.#time = 0;
    }
    isWithin (size) {
        const { position } = this.current;
        return (
            position.x > 0
            && position.x < size.x
            && position.y > 0
            && position.y < size.y
        );
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
    static tailColor = new Color(255, 255, 255, 160);
    static glowRadius = 25;
    static glowResolution = 5;
    static glowColor = new Color(255, 0, 0, 100);
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
            color.a = (color.a * factor).toFixed(2);
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
        this.drawGlow(cursor);
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
            this.#drawGlow(cursor, tail);
        }
        for (let i = 0; i < this.tail.length; i++) {
            const tail = this.tail[i];
            tail.draw(cursor, true);
            tail.transformation.restore();
            tail.applyTransformation();
            cursor.fill();
        }
        cursor.restore();
    }
    drawGlow (cursor) {
        this.#drawGlow(cursor, this.shape);
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
    collision (polygons = []) {
        const intersecting = [];
        const intersections = [];
        const shape = this.shape;
        const position = this.position.clone();
        for (const polygon of polygons)
            if (shape.isIntersecting(polygon)) intersecting.push(polygon);
        if (intersecting.length > 0) {
            for (const polygon of intersecting) {
                const overlap = shape.Polygon(1).overlap(polygon, true);
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
    #lastCollision; // may change every time update() is called. Contains the time (from Shot), position (Vector), direction (Vector), and normal (radians | undefined) of the last intersection, or undefined if none.
    #collisionCallback; // <bound to This> ([...{polygon: Polygon, overlap: Path}]) => undefined
    #updateCallback; // <bound to This> () => undefined
    #colliders; // list of polygons that can be collided with
    #isFinished = false; // trip this flag once projectile stops moving, never set again to prevent overlapping stages
    #isStarted = false; // trip this flag once we start updating projectile, never set again to prevent tracking errors
    #blastTimeOffset = 0; // offset time when creating new Blasts
    #finishedPromise = Promise.withResolvers();
    constructor (shot, delay = 0, blastsReference = [], collisionsReference = []) {
        if (!shot?.isShot) throw new Error(`[${this.constructor.name}]: Invalid parameter - expected Shot, got ${typeof shot}`);
        super();
        this.#shot = shot;
        this.#delayTime = delay;
        this.#blasts = blastsReference; // by reference
        this.#colliders = collisionsReference; // by reference
    }

    #shotOverlap () {
        const { shot, colliders } = this;
        const intersections = shot.collision(colliders);
        if (intersections?.length) {
            return intersections;
        } else if (
            this.blasts.some(({shape}) =>
                shape.isIntersecting(shot.shape))
        ) {
            // if there are no overlaps, we may be inside of a blast- check if exiting
            const overlaps = new Path();
            for (const { shape } of this.blasts) {
                overlaps.push(shape.overlap(shot.shape, true)); // [!] expensive operation
            }
            return [{
                polygon: colliders[0], // [!} temporary
                overlap: overlaps,
                normal: overlap.length >= 2 ? overlap.normal() : undefined
            }];
        } else return undefined; // nothing intersecting
        return intersections;
    }
    // returns time (relative to Shot), position (Vector), direction (Vector), normal (radians | undefined)
    #captureShotData () {
        const { shot, colliders } = this;
        let normal;
        const normals = this.#shotOverlap()
            ?.filter?.(({normal}) => normal)
            ?.map?.(({normal}) => normal);
        // [!] messy, fix soon - KT
        if (!normals?.length
            && this.blasts.some(({shape}) =>
                shape.isIntersecting(shot.shape))
        ) {
            // if there are no overlapping segements, find if we're exiting a blast...
            const overlaps = new Path();
            for (const { shape } of this.blasts) {
                overlaps.push(...shape.overlap(shot.shape, true));
            }
            normal = overlaps.normal();
        } else {
            normal = normals?.length
                ? Vector
                    .average(normals)
                    .normalize(true)
                : undefined;
        }
        // check for errors- invert normal if current position is on the wrong segment "side"
        if (normal !== undefined && shot.current.velocity.dot(normal) > 0) normal.mul(-1, true);
        return {
            time: shot.time,
            position: shot.position.clone(),
            direction: shot.current.velocity.normalize(),
            normal: normal
        };
    }
    // returns intersections if colliding, and undefined if not colliding with anything
    // intersections are [...{polygon: Polygon, overlap: Path}]
    #getIntersections () {
        const { shot, blasts, colliders } = this;
        const { shape } = shot;
        const position = shot.position.clone();
        const intersecting = [];
        const intersections = [];
        if (blasts.some(({shape: s}) =>
                shape.isIntersecting(s)
        )) return undefined; // don't return any overlap if we're inside of a blast
        for (const polygon of colliders)
            if (shape.isIntersecting(polygon)) intersecting.push(polygon);
        if (intersecting.length === 0) {
            return undefined; // nothing intersecting
        } else {
            for (const polygon of intersecting) {
                const overlap = polygon.overlap(shape.Polygon(1), true);
                intersections.push({
                    polygon,
                    overlap,
                    normal: overlap.length >= 2 ? overlap.normal() : undefined
                });
            }
        }
        return intersections;
    }

    update (seconds) {
        try {
            if (!this.#isStarted) this.#isStarted = true;
            {
                const isDelayed = this.time <= this.delay;
                this.time += seconds;
                if (isDelayed) return;
            }
            const { shot } = this;
            if (!shot.isStopped) {
                const intersections = this.#getIntersections();
                if (intersections === undefined) {
                    // do nothing, not colliding
                } else if (intersections.length) {
                    this.#lastCollision = this.#captureShotData();
                    this.collisionCallback?.(intersections);
                } else {
                    // should never happen. Log computed data
                    console.warn(`[${this.constructor.name}]: Failed to find intersection for collision`, intersections);
                }
            }
            shot.update(seconds);
            this.updateCallback?.();
            if (!this.#isFinished && shot.isStopped) {
                this.#isFinished = true;
                this.#finishedPromise.resolve();
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
    isWithin (size) {
        return this.shot.isWithin(size);
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
    get lastCollision () { return this.#lastCollision }
    get onend () { return this.#finishedPromise.promise }
    get time () { return this.#time }
    set time (value) { return (this.#time = value) }
    get blastTimeOffset () { return this.#blastTimeOffset }
    set blastTimeOffset (value) { return (this.#blastTimeOffset = value) }
    get collisionCallback () { return this.#collisionCallback }
    set collisionCallback (callbackFn) { return (this.#collisionCallback = callbackFn?.bind(this)) }
    get updateCallback () { return this.#updateCallback }
    set updateCallback (callbackFn) { return (this.#updateCallback = callbackFn?.bind(this)) }
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
    constructor (delay = 0, blastsReference = [], collisionsReference = []) {
        super();
        this.#delayTime = delay;
        this.#blasts = blastsReference;
        this.#colliders = collisionsReference;
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
            if (this.isFinished) this.#finishedPromise.resolve(); // [!] inefficient - resolves the same Promise repeatedly
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
        const stage = new ShotStage(shot, delay, this.blasts, this.colliders);
        stage.blastTimeOffset = this.blastTimeOffset;
        this.#shotStages.push(stage);
        return stage;
    }
    isWithin (size) {
        return this.stages.some((stage) => stage.isWithin(size));
    }
    // creates a fresh instance with the same ShotStages, callbacks, and delay. References and blast time offset are not copied.
    clone (deep = false, blastsReference = [], collisionsReference = []) {
        const multishot = new MultiShotStage(this.delay, blastsReference, collisionsReference);
        for (const stage of this.stages) {
            const newStage = multishot.newStage(stage.shot.clone(deep), stage.delay);
            newStage.collisionCallback = stage.collisionCallback;
        }
        return multishot;
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
}

// supports a sequence of shot or multishot stages
export class Ammo extends TrackableObject {
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
        const stage = new MultiShotStage(delay, this.blasts, this.colliders);
        this.#stages.push(stage);
        if (this.#stageIdx === 0 && this.#currentStage === undefined) this.#currentStage = this.#stages[this.#stageIdx];
        return stage;
    }
    // returns blasts over a given time
    trace (increment = 1/60, limit = 60, float64 = false) {
        const ammo = this.clone(true);
        const result = { time: undefined, state: ammo };
        while (ammo.time < limit && result.time === undefined) {
            ammo.update(increment);
            if (ammo.isFinished) result.time = ammo.time;
        }
        result.blasts = float64
            ? ammo.blasts.map((blast) => blast.decode())
            : [...ammo.blasts]; // dereference
        return result;
    }
    isWithin (size) {
        return this.currentStage === undefined
            ? false
            : this.currentStage.isWithin(size);
    }
    clone (deep = false) {
        const stages = [];
        for (const stage of this.#stages) stages.push(stage.clone(deep));
        const ammo = new Ammo(this.colliders, stages);
        return ammo;
    }

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

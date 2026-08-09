import { Vector } from "../math/Vector.js";
import { Path } from "../math/Path.js";
import { Ray } from "../math/Ray.js";
import { BoundingBox } from "../geometry/BoundingBox.js";
import { equals } from "../math/utils.js";
import { Identifiable } from "../utils/tracking/Identifiable.js";
import { typeString } from "../utils/logging.js";
import { Properties } from "./collision/Properties.js";
import { getSegmentCollision } from "./collision/utils.js";

// A stage of a projectile's lifetime
export class Shot extends Identifiable {
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
                        } else if (equals(hit.projectedCoeff, minCoeff)) {
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
    #projectile;
    #blasts;
    #time = 0; // global time, seperate from Projectile time
    #delayTime; // don't start updating projectile until this duration has passed
    #collisionCallback; // <bound to This> (point (contact point), normal (of colliding surface), collisionFlags) => undefined
    #updateCallback; // <bound to This> () => undefined
    #launchCallback; // <bound to This> () => undefined
    #colliders; // list of polygons that can be collided with
    #isFinished = false; // trip this flag once projectile stops moving, never set again to prevent overlapping stages
    #isStarted = false; // trip this flag once we start updating projectile, never set again to prevent tracking errors
    #applyDestruction = false; // push new blasts to collider polygon holes
    #blastTimeOffset = 0; // offset time when creating new Blasts
    #finishedPromise = Promise.withResolvers();
    #legend; // when set, Shot will skip all collision checks and follow based on this
    #record = { // records data to be exported
        collisions: [],
        duration: 0
    };
    #sfxCallback;
    #tracer = new Path();
    #hasLaunched = false;
    #playLaunchCallback = true;
    #displayBoundingBox; // optimization- when set, will only draw projectile if bounding box intersects with it
    userData = {};
    constructor (projectile, delay = 0, blastsReference = [], collisionsReference = [], sfxCallbackReference = {}) {
        super();
        if (!projectile?.isProjectile) throw new Error(`[${typeString(this)}]: Invalid parameter - expected Projectile, got ${typeof projectile}`);
        this.#projectile = projectile;
        this.#delayTime = delay;
        this.#blasts = blastsReference; // by reference
        this.#colliders = collisionsReference; // by reference
        this.#sfxCallback = sfxCallbackReference; // by reference
    }

    #projectToCollision (seconds = 1) {
        const { projectile, blasts, colliders } = this;
        const projection = projectile.project(seconds);
        // Approximate if any colliders lie between current state and given projection
        const nearbyColliders = colliders.filter((collider) =>
            projection.traversalArea.isIntersecting(collider.getBoundingBox()));
        let collision;
        if (nearbyColliders.length) {
            if (projectile.shape.isCircle && !projectile.shape.isEllipse)
                collision = Shot.getCircleCollision(projectile.position, projection, colliders);
            else
                throw new Error(`[${typeString(this)}]: Cannot compute collision for non-Circle projectile shape`);
        }
        if (collision) {
            projectile.applyPosition(collision.position);
            this.applyCollision(collision.point, collision.normal, collision.flags);
            return;
        }
        projectile.update(seconds);
    }
    #setFinished () { // [!] does not check if already finished. Caller is responsible for making sure this is only used once
        this.#isFinished = true;
        this.#finishedPromise.resolve();
    }
    #trackUpdate () { // [!] poorly named. Tracks data during update() calls
        this.#record.duration = this.time;
        this.tracer.push(this.projectile.position.clone());
    }

    // point is collision/contact point
    applyCollision (point, normal, collisionFlags) {
        const { time, projectile } = this;
        const position = projectile.position.clone();
        const velocity = projectile.current.velocity.clone();
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
        collision.resultVelocity = projectile.current.velocity.clone();
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
            const { projectile } = this;
            if (this.isTracing) {
                const { projectile } = this;
                this.time += seconds;
                if (!this.#isFinished) {
                    this.#projectToCollision(seconds);
                    this.updateCallback?.();
                    this.#trackUpdate();
                    if (!this.#isFinished && projectile.isStopped)
                        this.#setFinished();
                }
            } else {
                const legend = this.#legend;
                this.time += seconds;
                if (legend.collisions.length > 0
                    && this.time >= legend.collisions[0].time
                ) {
                    const { time, collisionFlags, position, point, velocity, normal } = legend.collisions.shift();
                    projectile.applyPosition(position);
                    projectile.current.velocity.apply(velocity);
                    this.applyCollision(point, normal, collisionFlags);
                } else {
                    projectile.update(seconds);
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
        const { isStarted, isFinished, projectile, delay, time } = this;
        if (isStarted && !isFinished && time > delay) projectile.draw(cursor);
    }
    drawGlow (cursor) {
        if (!this.isInsideDisplay) return;
        const { isStarted, isFinished, projectile, delay, time } = this;
        if (isStarted && !isFinished && time > delay) {
            projectile.drawTailGlow(cursor);
            projectile.drawMainGlow(cursor);
        }
    }
    drawBody (cursor) {
        if (!this.isInsideDisplay) return;
        const { isStarted, isFinished, projectile, delay, time } = this;
        if (isStarted && !isFinished && time > delay) {
            projectile.drawTail(cursor);
            projectile.drawShot(cursor);
        }
    }
    applyBlast (blast) {
        const hitbox = blast.clone(true);
        hitbox.shape.transform.offset.add(this.projectile.position, true);
        hitbox.shape.applyTransform();
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
        else console.warn(`[${typeString(this)}]: Unable to play SFX "${sfxName}" -  callback does not exist`);
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
            console.error(`[${typeString(this)}]: Error parsing legend object`);
            throw error;
        }
    }
    // creates a fresh instance with the same Projectile, delay and collision callback
    // References, userData, update callback, launch callback, and blast time offset are not copied.
    clone (deep = false, blastsReference = [], collisionsReference = []) {
        const stage = new Shot(this.projectile.clone(deep), this.delay, blastsReference, collisionsReference);
        stage.collisionCallback = this.collisionCallback;
        return stage;
    }

    get isShot () { return true }
    get isFinished () { return this.#isFinished }
    get isStarted () { return this.#isStarted } // [!] stage tracking- may be redundant
    get isTracing () { return this.#legend === undefined }
    get isInsideDisplay () { // [!] will return projectile as in-bounds if a display bbox is not set
        const { displayBoundingBox, projectile } = this;
        if (!displayBoundingBox) return true;
        return displayBoundingBox.isIntersecting(projectile.getBoundingBox(true));
    }
    get delay () { return this.#delayTime }
    get projectile () { return this.#projectile }
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
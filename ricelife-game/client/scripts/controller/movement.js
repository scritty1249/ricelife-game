import { Vector, Direction, Path, Ray } from "../geometry/geometry.js";
import { rad2deg, floatEqual } from "../utils.js";

export class InputListener {
    #keyCodeMap;
    #activeKeys;
    #activeKeysProxy;
    #listeningTo;
    constructor (listenTo, keyCodeMap) {
        this.#keyCodeMap = keyCodeMap;
        this.#activeKeys = Object.fromEntries(Array.from(Object.values(this.#keyCodeMap), (keyCode) => [keyCode, false]));
        this.#activeKeysProxy = new Proxy(this.#activeKeys, {
            set: () => false, // fail silently (throws error in strict mode)
            defineProperty: () => false,
            deleteProperty: () => false
        });
        this.#listeningTo = listenTo; // track the object
        this.#listeningTo.addEventListener("keydown", (event) => this.#setKeyState(event, true));
        this.#listeningTo.addEventListener("keyup", (event) => this.#setKeyState(event, false));
    }

    #setKeyState (event, keyDown) {
        if (Object.hasOwn(this.#keyCodeMap, event.code)) {
            this.#activeKeys[this.#keyCodeMap[event.code]] = keyDown;
            event.preventDefault();
        }
    }

    get listeningTo () { return this.#listeningTo }
    get activeKeys() { return this.#activeKeysProxy }
}

export class MovementController { // only moves along X axis
    #terrain;
    #range;
    #terrainHeight;
    #player;
    constructor (terrain, tank, offsetY = 0) {
        this.#player = tank;
        this.#terrain = terrain;
        this.#range = this.#terrain.path.points.slice(0, -2).map((pt) => pt.x).toSorted((a, b) => b - a).at(0); // [!] unsafe math
        this.#terrainHeight = Math.max(...this.#terrain.path.points.map(({y}) => y));
        this.offsetY = offsetY;
    }

    move (amount, resolution = .01) {
        if (Math.abs(amount) >= this.#range || floatEqual(amount, 0)) return;
        const position = this.#player.position;
        const movingRight = amount > 0;
        const targetX = position.x + amount;

        const hits = [...this.#findValidPoints(targetX)];
        if (!hits.length) {
            console.warn("[MovementController] Warning: No valid terrain found at or around target position");
            return false;
        }

        const hit = hits.at(0); // should already be sorted in decesnding order (from targetX to origin)
        console.log(hit.angle);
        // setting position
        position.x = hit.point.x;
        position.y = hit.point.y + this.offsetY;
        // setting rotation
        this.#player.rotation.body = hit.angle;
        return true;
    }

    set (amount, resolution = .01) {
        if (amount < 1 || amount >= this.#range) return;
        const position = this.#player.position;

        const maxHeight = this.#player.height + position.y + this.offsetY; // next position should not be going OVER this - under is still fine. (player would be falling)
        const ray = Ray(new Vector(amount, 0), Direction(90), this.#terrainHeight - 1);
        const hits = this.#terrain.raycast(ray);
        const exiting = hits.some(({entering}) => !entering);


        // remove duplicate/junk raycasting hits (i did some shit wrong)
        const hit = (exiting ? hits.filter(({entering}) => !entering) : hits)
            ?.toSorted((a, b) => b.point.y - a.point.y)?.at(0);
        if (!hit) {
            console.warn("[MovementController] Warning: No valid terrain found for Y position at X", hits);
            return false;
        }

        const angle = normalizeAngle(hit.angle, hit.entering);

        // setting position
        position.x = amount;
        position.y = hit.point.y + this.offsetY;
        // setting rotation
        this.#player.rotation.body = angle;
        return true;
    }

    *#findValidPoints (targetX) { // [!] TODO: THIS WILL ALLOW PLAYERS TO JUMP OVER PIXEL GAPS (INTENDED) BUT ALSO ALLOWS THEM TO PHASE THROUGH WALLS IF THIN ENOUGH
        const { position, width } = this.#player;
        const ray = Ray(new Vector(), Direction(90), this.#terrainHeight - 1);
        const movingRight = targetX > position.x;
        const maxHeight = position.y - (this.#player.height / 2); // next position should not be going OVER this - under is still fine. (player would be falling)
        const nodes = this.#terrain.edgeNodes;
        const slices = [];
        for (const node of nodes
                .filter(({point}) =>
                    point.y >= maxHeight
                    && (floatEqual(point.x, targetX)
                    || (movingRight && point.x + (width + 1) > position.x && point.x <= targetX)
                    || (!movingRight && point.x - (width + 1) < position.x && point.x >= targetX)))
                .toSorted((a, b) => Math.abs(targetX - a.point.x) - Math.abs(targetX - b.point.x))) // sort distance from closest to furthest to targetX
            // add to exisiting slice
            if (floatEqual(node.point.x, slices.at(-1)?.at(0)?.point?.x)) slices.at(-1).push(node);
            // push a new slice
            else slices.push([node]);
        for (const slice of slices) {
            slice.sort((a, b) => Math.abs(position.y - b.point.y) - Math.abs(position.y - a.point.y));
            const { point, prevNode, nextNode, hole } = slice.at(-1);
            ray.x = point.x;
            const inter = Path.intersectAngle(ray.at(0), ray.at(-1), prevNode, nextNode);
            const angle = normalizeAngle(inter.angle, inter.entering);
            yield { point, angle, entering: inter.entering };
        }
    }

    // // [!] unused for now, maybe implement in #closestValidRaycastPoint to reduce code redundancy
    // #getTraversableSlices (origin, targetX, resolution) { // intersections are orded from ORIGIN to TARGET. intersections does not include at ORIGIN itself
    //     const amount = targetX - origin.x;
    //     const path = [origin],
    //         slices = [];
    //     // get raycast hits around target position  - "slices" :)
    //     const maxDistance = Math.abs(amount);
    //     const sign = amount > 0 ? 1 : -1;
    //     const rayDirection = Direction(90);
    //     const rayOrigin = new Vector();
    //     const rayDistance = this.#terrainHeight - 1;
    //     for (let inc = resolution; inc < maxDistance; inc += resolution) {
    //         rayOrigin.x = origin.x + (inc * sign);
    //         const ray = this.#terrain.raycast(rayOrigin, rayDirection, rayDistance)
    //             .map((hit) => {
    //                 hit.angle = normalizeAngle(hit.angle, hit.entering);
    //                 return hit;
    //         });
    //         if (ray.length) slices.push(ray);
    //     }
    //     // build a path of points traversable from origin point
    //     for (const slice of slices) {
    //         const prevPt = path.at(-1);
    //         const maxHeight = prevPt.y + this.#player.height + this.offsetY;
    //         const validPts = slice.filter(({point}) => point.y <= maxHeight);
    //         if (validPts.length)
    //             path.push(validPts.length > 1
    //                 ? validPts.reduce((acc, curr) => curr.point.distance(prevPt) < acc.point.distance(prevPt) ? curr : acc, validPts.at(0))
    //                 : validPts.at(0)
    //             );
    //     }
    //     return path.slice(1);
    // }

    // #raycastValidPoints (targetX) {
    //     const position = this.#player.position;
    //     const ray = Ray(new Vector(targetX, 0), Direction(90), this.#terrainHeight - 1);
    //     const hits = this.#terrain.raycast(ray);
    //     const exiting = hits.some(({entering}) => !entering);
    //     const maxHeight = this.#player.height + position.y + this.offsetY; // next position should not be going OVER this - under is still fine. (player would be falling)
    //     const maxTranslateDistance = this.#player.height + this.offsetY;
    //     // remove duplicate/junk raycasting hits (i did some shit wrong)
    //     const hit = hits // (exiting ? hits.filter(({entering}) => !entering) : hits)
    //         ?.filter((hit) => {
    //             hit.angle = rad2deg(hit.angle) + (hit.entering ? 270 : 90); // [!] fuck it man just modify in-place
    //             return hit.point.y > maxHeight
    //                 ? position.distance(hit.point) <= maxTranslateDistance
    //                 : true;
    //         })?.toSorted((a, b) => Math.abs(b.point.y - position.y) - Math.abs(a.point.y - position.y))?.at(-1);
    //     return hit;
    // }

    // #closestValidRaycastPoint (targetX, resolution) {
    //     const position = this.#player.position;
    //     const amount = targetX - position.x;
    //     const slices = [];
    //     // get raycast hits around target position  - "slices" :)
    //     const maxHeight = this.#player.height + position.y + this.offsetY; // next position should not be going OVER this - under is still fine. (player would be falling)
    //     const maxTranslateDistance = this.#player.width;
    //     const maxDistance = Math.abs(amount);
    //     const sign = amount > 0 ? 1 : -1;
    //     const ray = Ray(new Vector(), Direction(90), this.#terrainHeight - 1);
    //     for (let inc = resolution; inc < maxDistance; inc += resolution) {
    //         ray.at(0).x = position.x + (inc * sign);
    //         slices.push(this.#terrain.raycast(ray)
    //             .filter((hit) => {
    //                 hit.angle = normalizeAngle(hit.angle, hit.entering);
    //                 return hit.point.y < maxHeight
    //                     ? position.distance(hit.point) <= maxTranslateDistance
    //                     : true;
    //         }));
    //     }
    //     // get slice closest to target X coord that has hits after filtering
    //     const hits = slices.filter((slice) => slice.length)?.at(-1);
    //     return hits
    //         ? hits.length === 1
    //             ? hits.at(0)
    //             // player is standing atop a hole, or IN a hole below the surface
    //             : hits.reduce((acc, curr) =>
    //                 Math.abs(curr.point.y - position.y) < Math.abs(acc.point.y - position.y) ? curr : acc, hits.at(0))
    //         : undefined;
    // }

    get rotation () {
        return this.#player.rotation.barrel;
    }
    
    get position () {
        return this.#player.position;
    }
}

function normalizeAngle (radians, pointingOut) {
    let degrees = rad2deg(radians) + (pointingOut ? 270 : 90);
    if (degrees < 0) degrees += 360;
    return degrees % 360;
}

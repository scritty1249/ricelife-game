import { equals } from "../../math/utils.js";
import { Vector } from "../../math/Vector.js";
import { Ray } from "../../math/Ray.js";
import { typeString } from "../../utils/logging.js";

export class Mover { // only moves along X axis
    static #getGroundLevel(x, maxHeight, terrainPolygon) {
        const ray = new Ray(new Vector(x, maxHeight), Vector.fromAngle((3 * Math.PI) / 2), maxHeight + 1);
        const hits = terrainPolygon.raycast(ray);
        if (!hits || !hits.length) return undefined;
        let highest = null;
        const hasExiting = hits.some(({ entering }) => !entering);
        for (let i = 0; i < hits.length; i++) {
            const hit = hits[i];
            if (hasExiting && !hit.entering) continue;
            if (!highest || hit.point.y > highest.point.y)
                highest = hit;
        }
        return highest;
    }
    static computePosition (position, heightOffset, terrainPolygon) {
        const pts = terrainPolygon.edgePoints;
        const terrainElevations = pts.map(({y}) => y);
        const terrainHeight = Math.max(...terrainElevations) - Math.min(...terrainElevations);
        const maxHeight = position.y + heightOffset;
        const hit = Mover.#getGroundLevel(position.x, maxHeight, terrainPolygon);
        if (!hit) {
            console.warn(`[${this.name}] Warning: No valid terrain found for Y position (from ${maxHeight}) at X ${position.x}`);
        } else {
            hit.angle -= Math.PI / 2;
        }
        return hit;
    }
    #Terrain;
    #terrainHash;
    #range;
    #terrainHeight;
    #puppet;
    offsetY = 0; // visual offset
    climbHeight = 0; // how much space above the puppet's actual position we allow the player to "climb" (jump) up
    constructor (puppet, terrain) {
        if (!puppet?.isPuppet) throw new Error(`[${typeString(this)}]: Invalid parameter - expected Puppet, got ${typeString(puppet)}`);
        this.#puppet = puppet;
        this.Terrain = terrain;
    }

    #applyToPlayer (x, y, angle) { // takes raw terrain normal(angle) and x,y coord, and sets player position and rotation with defined offsets
        const offset = this.#calculateOffset(angle);
        this.position.apply(x, y + offset);
        this.#puppet.rotation.body = angle - (Math.PI / 2);
    }
    #calculateOffset (bodyAngle) {
        const angle = bodyAngle || this.#puppet.rotation.body + (Math.PI / 2);
        return this.offsetY * Math.sin(angle);
    }
    #raycastPosition (x, y = undefined) {
        const maxHeight = (y || this.#puppet.position.y)
            + (this.climbHeight * Math.sin(this.#puppet.rotation.body + (Math.PI / 2)));
        return Mover.#getGroundLevel(x, maxHeight, this.Terrain.polygon);
    }

    computeTerrain (force = false) {
        const hash = this.Terrain?.polygon?.hash;
        if (hash === this.#terrainHash && !force) return;
        this.#terrainHash = hash;
        if (!this.Terrain) return;
        const pts = this.Terrain.polygon.edgePoints;
        this.#range = pts.map((pt) => pt.x).toSorted((a, b) => b - a).at(0); // [!] unsafe math
        const terrainElevations = pts.map(({y}) => y);
        this.#terrainHeight = Math.max(...terrainElevations) - Math.min(...terrainElevations);
    }
    move (amount) {
        this.computeTerrain();
        if (Math.abs(amount) >= this.#range || equals(amount, 0)) return;
        const targetX = this.#puppet.position.x + amount;
        const hit = this.#raycastPosition(targetX);
        if (!hit) return false;
        this.#applyToPlayer(hit.point.x, hit.point.y, hit.angle);
        return true;
    }
    apply (x, y = 0) {
        this.computeTerrain();
        if (x?.isVector) {
            y = x.y;
            x = x.x;
        }
        const hit = this.#raycastPosition(x, y);
        if (!hit) {
            console.warn(`[${typeString(this)}] Warning: No valid terrain found for Y position from (${x}, ${y})`);
            return false;
        }
        this.#applyToPlayer(x, hit.point.y, hit.angle);
        return true;
    }
    
    get isMover () { return true }
    get position () {
        return this.#puppet.position;
    }
    get Terrain () { return this.#Terrain }
    set Terrain (terrain) {
        this.#Terrain = terrain;
        this.computeTerrain(true);
        return terrain;
    }
}
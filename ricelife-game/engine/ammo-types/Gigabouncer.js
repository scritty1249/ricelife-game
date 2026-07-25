import MegaBouncer from "./megabouncer.js";
import { createBlasts } from "../core/projectile/collision/Behaviors.js";

export default class GigaBouncer extends MegaBouncer {
    static onBounce () {
        createBlasts.call(this);
    }
    static onBounceCallback () {} // override, don't play bounce sfx
    static maxBounces = 2;
    static stopOnPlayer = false; // keep bouncing after collidiing with player
}
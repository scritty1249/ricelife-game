export class Collision {
    // type of collisions accepted on an object
    static NONE = 0;
    static ENTER = 1 << 0; // only accept collisions from entering trajectories
    static EXIT = 1 << 1; // only accept collisions from exiting trajectories
    static ANY = Collision.ENTER | Collision.EXIT;
    // type of object being collided with
    static DESTRUCTION = 1 << 2;
    static PLAYER = 1 << 3;
    static BOUNDARY = 1 << 4; // [!] map border. may be bouncey idk yet - KT
    static STOP = 1 << 5; // instances that collide should stop and not perform any other TRAJECTORY behaviors (ex: don't bounce)
    static TRIGGER = 1 << 6; // instances that collide with this should immedately count this as a "final" collision
    static #compositeFlags = [Collision.ANY];
    static toObject (flags) { // [!] for debugging
        const state = {};
        for (const key of Object.getOwnPropertyNames(Collision)) {
            const flag = Collision[key];
            if (
                !Number.isInteger(flag) || 
                flag === Collision.NONE || // skip zero flag
                Collision.#compositeFlags.includes(flag) // don't double print flags that require a negative to determine
            ) continue;
            state[key] = (flags & flag) === flag;
        }
        return state;
    }
}
Object.freeze(Collision);

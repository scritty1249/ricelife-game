// handles keyframe data for destroying terrain and rendering explosion animations

export class BlastAnimation {
    #current = {
        frame: undefined,
        idx: 0
    };
    #terrain;
    #prev = {
        stamp: 0,
        retrieved: 0   
    };
    #keyframes = [];
    #ended = true;
    constructor (terrain, ...keyframes) {
        if (!keyframes.length) throw new Error("[BlastAnimation] Error: Keyframes required at initalization");
        this.#keyframes.push(...keyframes); // break references
        this.#current.frame = this.#keyframes.at(0);
        this.#ended = false;
    }

    #incrementKeyframe () {
        // For safety, throw an Error if there are no keyframes left.
        if (!this.#hasNext) throw new Error("[BlastAnimation] Error: Cannot increment past end of sequence");
        this.#prev.stamp = this.#current.frame.stamp;
        this.#prev.retrieved = performance.now();
        this.#current.frame = this.at(++this.#current.idx);
        if (!this.#hasNext) this.#ended = true;
    }

    next () {
        // return current frame, then increment keyframes.
        const current = this.#current.frame;
        this.#incrementKeyframe();
        return current;
    }

    ended () { return this.#ended }

    ready () {
        // returns if enough time has elapsed since last frame was retrieved for the next frame in the sequence
        return performance.now() - this.#prev.retrieved > this.interval;
    }

    at (...args) { return this.#keyframes.at(...args) }

    get #hasNext () { return this.#current.idx + 1 < this.length } // should only be calling this in the increment private function. use #ended for everything else internally.
    get length () { return this.#keyframes.length }
    get interval () {
        // return MS between current keyframe and next keyframe.
        // Default to 0 if current keyframe is first in the sequence, and undefined if no keyframes are left.
        if (this.#ended) return undefined;
        else if (this.#current.idx === 0) return 0;
        else return this.#current.frame.stamp - this.#prev.stamp;
    }
    get stamp () {
        // return timestamp (MS) of the current frame, from the first keyframe.
        // Default to undefined if no keyframes are left.
        if (this.#ended) return undefined;
        else return this.#current.frame.stamp - this.at(0).stamp;
    }
}

// export class BlastKeyframe {
//     #stamp;
//     #blasts;
//     #terrain;
//     constructor (timestampMs, blast, terrain) {
//         this.#stamp = timestampMs;
//         this.#blasts = blasts;
//         this.#terrain = terrain; // pass by reference to chain changes between keyframes
//     }

//     get terrain () { return this.#stamp }
//     get stamp () { return this.#stamp }
//     get blasts () { return this.#blasts }
// }

// export class Blast { // individual explosion shape
//     #draw;
//     // because shape needs to be cloned to maintain position, this class may cause excessive performance drag. If the game suffers, look into refactoring this. - KT
//     constructor (shape, color, drawFn = (ctx) => {}) { // shape expected to be at final position
//         this.shape = shape;
//         this.color = color.clone();
//         this.#draw = drawFn.bind(this);
//     }

//     get draw () { return this.#draw }
// }

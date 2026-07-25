import { typeString } from "../utils/logging.js";

export class AnimationList {
    #animations = new Array();
    constructor (...animations) {
        this.push(...animations);
    }

    push (...animations) {
        for (const animation of animations) {
            if (animation?.isAnimationList) this.push(...animation);
            else if (!animation?.isAnimation) throw new Error(`[${typeString(this)}] Error: Cannot add non-animation of type ${typeString(animation)}`);
            else this.#animations.push(animation);
        }        
    }
    update (cursor) {
        const animations = this.#animations.filter((ani) => !ani.ended);
        this.#animations.splice(0, this.length);
        this.#animations.push(...animations);
        this.#animations.forEach((ani) => ani.draw(cursor));
    }
    play () {
        for (const ani of this.#animations)
            ani.play();
        return this;
    }
    pause () {
        for (const ani of this.#animations)
            ani.pause();
        return this;
    }

    *[Symbol.iterator]() {
        yield *this.#animations;
    }

    get isAnimationList () { return true }
    get playing () { return this.#animations.some((ani) => ani.playing) }
    get length () { return this.#animations.length }
    get onend () { return Promise.all(this.#animations.map((ani) => ani.onend)) }
    get ended () { return this.#animations.every((ani) => ani.ended) || !this.length }
}

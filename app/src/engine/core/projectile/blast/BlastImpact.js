import { AnimationList } from "../../animation/AnimationList.js";

export class BlastImpact {
    #Animations = new AnimationList();
    #audioContext;
    #blastSFXLayer;
    #blastSFXSource;
    #AudioLayers = new Map();
    #triggered = false;
    #triggerPromise = Promise.withResolvers();
    #resolvePayload;
    #animationFactory;
    #blastInterval;
    // [!] stores everything by reference
    constructor (audioContext, blastSFXLayer, blastSFXSource, blastInterval, blastAnimationFactory) {
        this.#audioContext = audioContext;
        this.#blastSFXLayer = blastSFXLayer;
        this.#blastSFXSource = blastSFXSource;
        this.#blastInterval = blastInterval;
        this.#animationFactory = blastAnimationFactory;
        this.#init();
    }

    #init () {
        const { blasts } = this.#blastInterval;
        for (let i = 0; i < blasts.length; i++) {
            const blast = blasts.at(i);
            const blastSize = blast.shape.getBoundingBox().extent;
            // vfx
            const animation = this.#animationFactory(blast);
            // sfx
            const blastVolume = (blastSize / 50)**3;
            const sfxNode = this.#blastSFXSource.Instance();
            this.#getAudioLayer(blastVolume)
                .add(sfxNode);
            animation.onstart.then(() => sfxNode.play());
            this.Animations.push(animation);
        }
        this.#resolvePayload = {
            frame: this.#blastInterval.frame,
            terrain: this.#blastInterval.terrain,
            combinedbbox: this.#blastInterval.boundingBox,
            bboxes: this.#blastInterval.boundingBoxes,
            blasts: blasts,
            animations: this.Animations
        };
    }
    #getAudioLayer (gain) {
        if (this.#AudioLayers.has(gain)) {
            return this.#AudioLayers.get(gain);
        } else {
            const bassFilter = this.#audioContext.newBassNode();
            bassFilter.frequency.value = 200;
            bassFilter.gain.value = gain;
            const audioLayer = this.#blastSFXLayer.Layer([bassFilter], true);
            this.#AudioLayers.set(gain, audioLayer);
            return audioLayer;
        }
    }

    play () {
        if (this.isTriggered) return;
        this.#triggered = true;
        this.#triggerPromise.resolve(this.#resolvePayload);
    }
    clone (deep = false) {
        const blastInterval = deep ? this.#blastInterval.clone(true) : this.#blastInterval;
        return new BlastImpact(
            this.#audioContext,
            this.#blastSFXLayer,
            this.#blastSFXSource,
            blastInterval,
            this.#animationFactory
        );
    }

    get isBlastImpact () { return true }
    get isTriggered () { return this.#triggered }
    get Animations () { return this.#Animations }
    get ontrigger () { return this.#triggerPromise.promise }
    get time () { return this.#blastInterval.delay }
}
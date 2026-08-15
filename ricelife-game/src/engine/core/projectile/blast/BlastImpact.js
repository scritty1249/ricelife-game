import { AnimationList } from "../../animation/AnimationList.js";

export class BlastImpact {
    #Animations = new AnimationList();
    #audioContext;
    #blastSFXLayer;
    #blastSFXSource;
    #AudioLayers = new Map();
    #triggered = false;
    #frame;
    #blastBboxes = new Array();
    #triggerPromise = Promise.withResolvers();
    #terrain;
    #time;
    #blasts;
    #resolvePayload;
    #animationFactory;
    // [!] stores everything by reference
    constructor (audioContext, blastSFXLayer, blastSFXSource, blastInterval, blastAnimationFactory) {
        this.#audioContext = audioContext;
        this.#blastSFXLayer = blastSFXLayer;
        this.#blastSFXSource = blastSFXSource;
        this.#terrain = blastInterval.terrain;
        this.#frame = blastInterval.frame;
        this.#time = blastInterval.delay;
        this.#blasts = blastInterval.blasts;
        this.#animationFactory = blastAnimationFactory;
        this.#init();
    }

    #init () {
        for (let i = 0; i < this.#blasts.length; i++) {
            const blast = this.#blasts.at(i);
            const bbox = blast.shape.getBoundingBox();
            const blastSize = bbox.extent;
            this.#blastBboxes.push(bbox);
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
            frame: this.#frame,
            terrain: this.#terrain,
            combinedbbox: this.#blastBboxes.length < 2 ? this.#blastBboxes[0] : BoundingBox.merge(this.#blastBboxes),
            bboxes: this.#blastBboxes,
            blasts: this.#blasts,
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

    get isBlastImpact () { return true }
    get isTriggered () { return this.#triggered }
    get Animations () { return this.#Animations }
    get ontrigger () { return this.#triggerPromise.promise }
    get time () { return this.#time }
}
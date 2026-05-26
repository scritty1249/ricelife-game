export class ResizedImage {
    #img;
    #width;
    #height;
    #loadPromise;
    #scale;
    #ready = false;
    constructor (src, width = undefined, scale = undefined) {
        this.#width = 0;
        this.#height = 0;
        this.#img = new Image();
        this.#loadPromise = new Promise((resolve, reject) => {
            this.#img.onerror = (e) => (this.#ready = undefined, reject(e));
            this.#img.onload = () => {
                this.#ready = true;
                this.#scale = (width === undefined) ? scale : width / this.#img.width;
                this.#width = this.#scale * this.#img.width
                this.#height = this.#scale * this.#img.height;
                resolve(this);
            };

        });
        this.#img.src = src;
    }
    get ready () { return this.#ready; }
    get onload () { return this.#ready ? Promise.resolve(this) : this.#loadPromise; }
    get img () {
        if (!this.#ready)
            throw new Error("[ResizedImage] Error: Cannot access image - not loaded");
        return this.#img;
    }
    get width () { return this.#width; }
    get height () { return this.#height; }
    get scale () { return this.#scale; }
}

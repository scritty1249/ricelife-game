export class Slider {
    #slideEl;
    #valEl;
    #value;
    #min;
    #max;
    #step;
    #onchangeCallback;
    #defaultValue;
    precision = 1;
    constructor (sliderElement, valueElement, min = 0.1, max = 10, startingValue = 1, step = 0.1) {
        this.#slideEl = sliderElement;
        this.#valEl = valueElement;
        this.#min = min;
        this.#max = max;
        this.#step = step;
        this.#defaultValue = this.#clamp(startingValue);
        this.#init();
        this.reset();
    }
    
    #clamp (number) {
        return Math.min(Math.max(number, this.#min), this.#max);
    }
    #onInput = (event) => {
        const value = parseFloat(event.target.value);
        if (!Number.isNaN(value)) this.value = value;
    }
    #init () {
        const stepString = this.#step.toString();
        this.precision = stepString.includes('.')
            ? stepString.split('.')[1].length
            : 0;
        const slider = this.#slideEl;
        const field = this.#valEl;
        slider.addEventListener("input", this.#onInput);
        field.addEventListener("input", this.#onInput);

        slider.min = this.min;
        slider.max = this.max;
        slider.step = this.#step;

        slider.value = this.#defaultValue;
        field.value = this.#defaultValue;

        this.#value = this.#defaultValue;
    }

    reset () {
        this.value = this.#defaultValue;
    }
    close () {
        this.#slideEl.removeEventListener("input", this.#onInput);
        this.#valEl.removeEventListener("input", this.#onInput);
    }

    get min () { return this.#min }
    get max () { return this.#max }
    get onchange () { return this.#onchangeCallback }
    set onchange (callbackFn) { return (this.#onchangeCallback = callbackFn) }
    get value () { return this.#value }
    set value (number) {
        const num = this.#clamp(number);
        const value = num.toFixed((this.#step % 1 === 0) ? 0 : this.precision);
        this.#slideEl.value = value;
        this.#valEl.value = value;
        this.#value = num;
        this.#onchangeCallback?.();
        return num;
    }
}
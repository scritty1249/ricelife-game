export class DrawingCanvas {
    static CANVAS_RESOLUTION = 2000;
    static #pathStrokeOptions = {
        strokeStyle: "#D0D0D0",
        lineWidth: 3,
        lineCap: "round",
        lineJoin: "round"
    };
    static #stablizerStrokeOptions = {
        strokeStyle: "#00e8f07f",
        lineWidth: 2,
        lineCap: "round",
        lineJoin: "round"
    };
    #canvas;
    #slider;
    #ctx;
    #rect;
    #precision;
    #stablizer = {
        length: 0
    };
    #pen = {
        x: 0,
        y: 0
    };
    #scale = {
        x: 1,
        y: 1,
        average: 1
    };
    #stroke = {
        current:[],
        all: []
    };
    #strokeOptions = {
        path: undefined,
        stablizer: undefined   
    };
    #penOptions;
    enabled = true;
    snapDistance = 50;
    smoothingPasses = 2;
    constructor(canvasElement, stablizerSlider, cooridnatePrecision = 2, pathStrokeOptions = {}, stablizerStrokeOptions = {}) {
        this.#canvas = canvasElement;
        this.#slider = stablizerSlider;
        this.#ctx = this.canvas.getContext("2d");
        this.#precision = cooridnatePrecision;
        this.#strokeOptions.path = { ...DrawingCanvas.#pathStrokeOptions, ...pathStrokeOptions };
        this.#strokeOptions.stablizer = { ...DrawingCanvas.#stablizerStrokeOptions, ...stablizerStrokeOptions };
        
        this.isDrawing = false;
        this.currentPoints = []; 
        this.allStrokes = []; 

        this.#stablizer.length = this.slider.value;
        this.#init();
    }

    #init () {
        this.canvas.width = this.canvas.height = DrawingCanvas.CANVAS_RESOLUTION;
        this.#onResize();
        this.drawAllStrokes();
        this.#attachListeners();        
    }
    #toPrecision (number) {
        const multiplier = 10 ** this.#precision;
        return Math.round(number * multiplier) / multiplier;
    }
    #attachListeners () {
        window.addEventListener("contextmenu", (e) => e.preventDefault());
        window.addEventListener("mousedown", (e) => {
            if (this.isDrawing) this.lastPressedButton = e.button; // 0 - ;eft, 2 - right
            else this.startStroke(e);
        });
        window.addEventListener("mousemove", (e) => this.drawStroke(e));
        window.addEventListener("mouseup", (e) => {
            if (e.buttons === 0) this.endStroke();
            else this.lastPressedButton = (e.button === 2) ? 0 : 2;
        });
        window.addEventListener("touchstart", (e) => this.startStroke(e.touches[0]));
        window.addEventListener("touchmove", (e) => { 
            if (this.isDrawing) { 
                this.drawStroke(e.touches[0]); 
                e.preventDefault(); 
            } 
        }, { passive: false });
        window.addEventListener("touchend", () => this.endStroke());
        window.addEventListener("resize", () => this.#onResize());
        this.slider.onchange = () => this.#stablizer.length = this.slider.value;
    }
    #onResize () {
        this.#rect = this.canvas.getBoundingClientRect();
        this.#scale.x = this.canvas.width / this.#rect.width;
        this.#scale.y = this.canvas.height / this.#rect.height;
        this.#scale.average = (this.#scale.x + this.#scale.y) / 2;
    }
    #toRelativePosition (event) {
        return {
            x: (event.clientX - this.#rect.left) * this.#scale.x,
            y: (event.clientY - this.#rect.top) * this.#scale.y
        };
    }
    #setPenRelative (event) {
        this.setPen(
            (event.clientX - this.#rect.left) * this.#scale.x,
            (event.clientY - this.#rect.top) * this.#scale.y
        );
    }
    #clearCurrentPath () { this.#stroke.current.splice(0, this.#stroke.current.length) }
    #setStrokeOptions (options) {
        const { ctx } = this;
        const { strokeStyle, lineWidth, lineCap, lineJoin } = options;
        if (strokeStyle !== undefined) ctx.strokeStyle = strokeStyle;
        if (lineWidth !== undefined) ctx.lineWidth = lineWidth * this.#scale.average;
        if (lineCap !== undefined) ctx.lineCap = lineCap;
        if (lineJoin !== undefined) ctx.lineJoin = lineJoin;
    }
    #applySmoothing (stroke) { // Chaikin’s algorithm
        if (!stroke || stroke.length < 6) return stroke;
        let output = [];
        
        // Keep the exact starting node position locked
        output.push(stroke[0], stroke[1]);

        // Slice corners at 25% and 75% geometric ratios
        for (let i = 0; i < stroke.length - 2; i += 2) {
            const x0 = stroke[i];
            const y0 = stroke[i + 1];
            const x1 = stroke[i + 2];
            const y1 = stroke[i + 3];

            output.push(
                0.75 * x0 + 0.25 * x1,
                0.75 * y0 + 0.25 * y1,
                0.25 * x0 + 0.75 * x1,
                0.25 * y0 + 0.75 * y1
            );
        }

        // Keep the exact terminal endpoint position locked
        output.push(stroke[stroke.length - 2], stroke[stroke.length - 1]);
        return output;
    }

    #drawStroke (stroke, options) {
        if (!stroke || stroke.length < 4) return;
        
        // 1. Run Chaikin loops recursively based on your active smoothing setting
        let smoothedStroke = [...stroke];
        for (let pass = 0; pass < this.smoothingPasses; pass++) {
            smoothedStroke = this.#applySmoothing(smoothedStroke);
        }

        // 2. Render the final smoothed array coordinates to the canvas screen
        const ctx = this.#ctx;
        ctx.beginPath();
        this.#setStrokeOptions(options);

        ctx.moveTo(smoothedStroke[0], smoothedStroke[1]);
        for (let i = 2; i < smoothedStroke.length; i += 2) {
            ctx.lineTo(smoothedStroke[i], smoothedStroke[i + 1]);
        }
        ctx.stroke();
    }



    setPen (x, y) {
        this.pen.x = x;
        this.pen.y = y;
    }
    startStroke (event) {
        if (this.isDrawing) return; 
        if (!(event.target && this.enabled)) return;
        
        this.isDrawing = true;
        this.#setPenRelative(event);
        this.#clearCurrentPath();

        this.lastPressedButton = event.button;

        const allStrokes = this.#stroke.all;
        if (allStrokes.length > 0) {
            const lastStroke = allStrokes[allStrokes.length - 1];
            if (lastStroke && lastStroke.length >= 2) {
                const lastX = lastStroke[lastStroke.length - 2];
                const lastY = lastStroke[lastStroke.length - 1];

                const dx = this.pen.x - lastX;
                const dy = this.pen.y - lastY;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance <= this.snapDistance * this.#scale.average) {
                    this.pen.x = lastX;
                    this.pen.y = lastY;
                }
            }
        }

        // Proceed with normal baseline point stream initialization
        if (!this.#stroke.all.length)
            this.#stroke.current.push( 0, this.#toPrecision(this.pen.y) );
        this.#stroke.current.push( this.#toPrecision(this.pen.x), this.#toPrecision(this.pen.y) );
        
        this.ctx.beginPath();
        this.ctx.moveTo(this.pen.x, this.pen.y);
    }
    drawStroke (event) {
        if (!(this.enabled && this.isDrawing)) return;

        const coords = this.#toRelativePosition(event);
        const targetX = coords.x;
        const targetY = coords.y;
        const dx = targetX - this.pen.x;
        const dy = targetY - this.pen.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const oldPenX = this.pen.x;
        const oldPenY = this.pen.y;

        if (event.buttons === 1) this.lastPressedButton = 0;
        if (event.buttons === 2) this.lastPressedButton = 2;
        const isRightClickHeld = (event.buttons === 2) || (event.buttons === 3 && this.lastPressedButton === 2);

        if (distance > this.#stablizer.length) {
            const angle = Math.atan2(dy, dx);
            const nextPenX = targetX - Math.cos(angle) * this.#stablizer.length;
            const nextPenY = targetY - Math.sin(angle) * this.#stablizer.length;

            if (isRightClickHeld && this.#stroke.current.length >= 4)
                    this.#stroke.current.splice(this.#stroke.current.length - 2);
            if (this.#stroke.current.length >= 2
                && nextPenX >= 0
                && nextPenX <= this.canvas.width
                && this.pen.y <= this.canvas.height
                && nextPenY > this.canvas.height
            ) {
                // clamp pen to bottom of canvas
                this.pen.x = nextPenX;
                this.pen.y = this.canvas.height - 1;
                this.#stroke.current.push(this.pen.x, this.pen.y);
            } else if (this.#stroke.current.length >= 2
                && oldPenX >= 0
                && nextPenX < 0
            ) {
                // clamping Y
                this.pen.x = 0;
                this.pen.y = Math.min(Math.max(nextPenY, 0), this.canvas.height - 1);
                this.#stroke.current.push(this.pen.x, this.pen.y);
            } else if (this.#stroke.current.length >= 2
                && oldPenX <= this.canvas.width
                && nextPenX > this.canvas.width
            ) {
                // clamping Y
                this.pen.x = this.canvas.width;
                this.pen.y = Math.min(Math.max(nextPenY, 0), this.canvas.height - 1);
                this.#stroke.current.push(this.pen.x, this.pen.y);
            } else {
                // normal movement
                this.pen.x = nextPenX;
                this.pen.y = nextPenY;
                this.#stroke.current.push(this.#toPrecision(this.pen.x), this.#toPrecision(this.pen.y));
            }

            // anchor to X to bounds if we're coming in from off the canvas
            if (!isRightClickHeld && this.#stroke.current.length >= 2 && oldPenY >= 0 && oldPenY <= this.canvas.height) {

                const deltaX = this.pen.x - oldPenX;
                if (deltaX !== 0) {
                    const deltaY = this.pen.y - oldPenY;
                    const m = deltaY / deltaX;
                    let targetX = null;
                    if (this.pen.x > 0 && this.pen.x <= this.canvas.width && oldPenX < 0) {
                        targetX = 0; // coming in from left
                    } else if (this.pen.x >= 0 && this.pen.x < this.canvas.width && oldPenX >= this.canvas.width) {
                        targetX = this.canvas.width; // coming in from right
                    }
                    if (targetX !== null) {
                        const rawInterceptY = oldPenY + m * (targetX - oldPenX);
                        const interceptY = Math.min(Math.max(rawInterceptY, 0), this.canvas.height);
                        if (targetX === 0) {
                            this.#stroke.current.unshift(
                                this.#toPrecision(targetX), 
                                this.#toPrecision(interceptY)
                            );
                        } else {
                            this.#stroke.current.push(
                                this.#toPrecision(targetX), 
                                this.#toPrecision(interceptY)
                            );
                        }
                    }
                }
            }
        }

        const { ctx } = this;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawAllStrokes();

        if (this.#stroke.current.length > 2) {
            this.#drawStroke(this.#stroke.current, this.#strokeOptions.path);
            if (isRightClickHeld) {
                const len = this.#stroke.current.length;
                const lastValidX = this.#stroke.current[len - 2];
                const lastValidY = this.#stroke.current[len - 1];
                
                ctx.beginPath();
                this.#setStrokeOptions(this.#strokeOptions.path);
                ctx.moveTo(lastValidX, lastValidY);
                ctx.lineTo(this.pen.x, this.pen.y);
                ctx.stroke();
            }
        }

        ctx.beginPath();
        this.#setStrokeOptions(this.#strokeOptions.stablizer);
        ctx.moveTo(this.pen.x, this.pen.y);
        ctx.lineTo(targetX, targetY);
        ctx.stroke();
    }
    endStroke () {
        if (!(this.isDrawing && this.enabled)) return;
        this.isDrawing = false;
        const { current, all } = this.#stroke;
        
        if (current.length >= 4) {
            const lastX = current[current.length - 2];
            const lastY = current[current.length - 1];
            
            // Commit the trailing straight line node point right before saving to history
            if (this.#toPrecision(this.pen.x) !== lastX || this.#toPrecision(this.pen.y) !== lastY) {
                current.push(this.#toPrecision(this.pen.x), this.#toPrecision(this.pen.y));
            }
            all.push(current.splice(0, current.length - (current.length % 2)));
        }
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.drawAllStrokes();
    }
    drawAllStrokes () {
        const options = this.#strokeOptions.path;
        this.#stroke.all.forEach((stroke) => this.#drawStroke(stroke, options));
    }
    clear () {
        this.#stroke.all.splice(0, this.#stroke.all.length);
        this.#stroke.current.splice(0, this.#stroke.current.length);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    exportData (scaleX = 1.0, scaleY = 1.0, baseY = 0) {
        if (this.#stroke.all.length === 0) return null;

        const visiblePoints = [];
        const allPoints = this.#stroke.all.flatMap((stroke) => stroke);
        for (let i = 0; i < allPoints.length; i+=2) {
            const x = allPoints[i];
            const y = allPoints[i + 1];
            if (visiblePoints.length >= 2 && visiblePoints.at(-2) === x)
                visiblePoints.splice(-2);
            if (x >= 0 && x <= this.canvas.width && y >= 0 && y <= this.canvas.height)
                visiblePoints.push(x, (this.canvas.height - y));
        }
        if (visiblePoints.length === 0) return null;
        const points = visiblePoints.map((value, i) =>
            (i % 2 ? baseY : 0) + Math.round(value * (i % 2 ? scaleY : scaleX)));
        const allX = points.filter((_, i) => !(i % 2));
        const allY = points.filter((_, i) => i % 2);
        const maxX = Math.ceil(Math.max(...allX));
        const maxY = Math.ceil(Math.max(...allY));

        return [ points.length + 2, maxX, maxY, ]
            .concat(points)
            .join("\n");
    }

    get canvas () { return this.#canvas }
    get slider () { return this.#slider }
    get ctx () { return this.#ctx }
    get pen () { return this.#pen }
    get rect () { return this.#rect }
}

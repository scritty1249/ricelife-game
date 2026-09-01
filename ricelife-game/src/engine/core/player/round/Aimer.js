import { Vector } from "../../math/Vector.js";
import { Color } from "../../math/Color.js";
import { Circle } from "../../geometry/Circle.js";
import { Triangle } from "../../geometry/Triangle.js";
import { clamp, equals } from "../../math/utils.js";
import { typeString } from "../../utils/logging.js";
import { Identifiable } from "../../utils/tracking/Identifiable.js";

export class Aimer extends Identifiable { // takes control of rotation for a Tank barrel
    static DEFAULT = {
        circleColor: new Color(255, 255, 255, .025),
        beamColor: new Color(255, 255, 255, .05),
        coneColor: new Color(255, 255, 255, 0.075)
    };
    #puppet;
    #radius;
    #rotation;
    #power = 1;
    #pointerPosition = new Vector(); // player last recorded click location
    #pointerRecorded = false; // sentinal value
    #display;
    hide = false; // mimics MenuItem.hide behavior
    constructor (puppet, radius, circleColor, beamColor, coneColor) {
        super();
        if (!puppet?.isPuppet) throw new Error(`[${typeString(this)}]: Expected Puppet, got ${typeString(puppet)}`);
        this.#puppet = puppet;
        this.#radius = radius;
        this.#rotation = this.#puppet.rotation.barrel; // radians
        this.#initDisplay(
            circleColor || Aimer.DEFAULT.circleColor.clone(),
            beamColor || Aimer.DEFAULT.beamColor.clone(),
            coneColor || Aimer.DEFAULT.coneColor.clone()
        );
    }

    #initDisplay (circleColor, beamColor, coneColor) {
        const fullBeamWidth = this.#radius / 3;
        const fullConeWidth = fullBeamWidth / 2;
        const circle = new Circle(this.#radius);
        const outerTriangle = new Triangle();
        outerTriangle.bottomLength = fullBeamWidth;
        outerTriangle.height = this.#radius;
        const innerTriangle = outerTriangle.clone();
        innerTriangle.bottomLength = fullConeWidth;
        this.#display = {
            circle: {
                shape: circle,
                color: circleColor
            },
            // [!] running out of names...
            triangle: { // outer
                shape: outerTriangle,
                minWidth: fullBeamWidth / 3,
                widthMultiplier: (fullBeamWidth / 3) * 1.5,
                color: beamColor
            },
            cone: { // inner
                shape: innerTriangle,
                minWidth: fullConeWidth / 3,
                widthMultiplier: (fullConeWidth / 3) * 1.5,
                color: coneColor
            }
        };
    }
    // updates "beam" and "cone" triangle based on barrel angle. Does not update barrel- stored angle takes precedence over angle derived from pointer here
    #updateTriangles () {
        const angle = this.rotation;
        const position = this.#puppet.relativePosition;
        const { radius, power } = this;
        const expPow = power ** 4; // for scaling width of triangles
        {
            const { shape, minWidth, widthMultiplier } = this.#display.triangle;
            shape.bottomLength = minWidth + (widthMultiplier * expPow);
            shape.height = radius * power * (equals(power, 1) ? 1 : .95);
            shape.transform.offset = position.sub(shape.origin);
            shape.transform.angle = angle;
            shape.applyTransform();
        }
        {
            const { shape, minWidth, widthMultiplier } = this.#display.cone;
            shape.bottomLength = minWidth + (widthMultiplier * expPow);
            shape.height = radius * power;
            shape.transform.offset = position.sub(shape.origin);
            shape.transform.angle = angle;
            shape.applyTransform();
        }
    }
    #drawPowerCircle (cursor) {
        const { shape, color } = this.#display.circle;
        cursor.save();
        cursor.fillStyle = color.toString();
        shape.draw(cursor, true);
        cursor.fill();
        cursor.restore();
    }
    #drawAngleTriangle (cursor, triangle) {
        const { shape, color } = triangle;
        cursor.save();
        cursor.fillStyle = color.toString();
        cursor.beginPath();
        shape.draw(cursor, false);
        cursor.closePath();
        cursor.fill();
        cursor.restore();
    }
    #powerFromPointer () { return this.#puppet.relativePosition.distance(this.pointer) / this.#radius } // unclamped
    #angleFromPointer () { return ((this.pointer.angle(this.#puppet.relativePosition) - (Math.PI / 2)) + (Math.PI * 2)) % (Math.PI * 2) } // normalized

    draw (cursor) {
        if (this.hide) return;
        const { circle, triangle, cone } = this.#display;
        const position = this.#puppet.position.add(this.#puppet.offset.barrel);
        // only need to update positions
        circle.shape.moveTo(position);
        triangle.shape.moveTo(position);
        cone.shape.moveTo(position);

        cursor.save();
        this.#drawPowerCircle(cursor);
        cursor.clip();
        this.#drawAngleTriangle(cursor, triangle);
        this.#drawAngleTriangle(cursor, cone);
        cursor.restore();
    }

    update (point) { // updates barrel too
        if (!this.#pointerRecorded) {
            this.#pointerRecorded = true;
            this.#pointerPosition.apply(point);
        } else this.pointer.apply(point); // prefer the getter when possible
        this.#rotation = this.#puppet.rotation.barrel = this.#angleFromPointer();
        this.#power = clamp(this.#powerFromPointer(), 0, 1);
        // point triangle at pointer position- if we don't get another update, hold the same angle
        this.#updateTriangles();
    }

    // support for clickable object type
    isOver (point) {
        if (this.hide) return false;
        const { shape } = this.#display.circle;
        return shape.isIntersecting(point);
    }
    ondrag (point) { if (!this.hide) this.update(point) }
    onclick (point) { if (!this.hide) this.update(point) }
    onhold (point) { if (!this.hide) this.update(point) }

    get isAimer () { return true }
    get keepDragFocus () { return true } // button property
    get pointer () { if (this.#pointerRecorded) return this.#pointerPosition; else throw new Error(`[${typeString(this)}] Error: Pointer position not set`) }
    get radius () { return this.#radius }
    get power () { return this.#power }
    set power (value) {
        const result = this.#power = clamp(value, 0, 1);
        this.#updateTriangles();
        return result;
    }
    get rotation () { return this.#rotation }
    set rotation (radians) {
        const result = this.#puppet.rotation.barrel = this.#rotation = radians;
        this.#updateTriangles();
        return result;
    }
}

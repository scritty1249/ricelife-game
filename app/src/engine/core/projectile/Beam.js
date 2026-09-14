import { Projectile } from "./Projectile.js";

export class Beam extends Projectile {
    tailScale = 1;

    #drawTailPath (cursor) {
        cursor.beginPath();
        cursor.moveTo(this.position);
        const { tail } = this;
        for (let i = tail.length - 1; i >= 0; i--) {
            cursor.lineTo(tail[i].center);
        }
        cursor.stroke();
    }

    updateTail () {
        if (!this.tailLength) return;
        if (!this.tail.length || !this.shape.center.eq(this.tail[0].center)) {
            const tail = this.shape.clone(true);
            tail.transform.save();
            tail.transform.reset();
            tail.transform.scale.apply(this.tailScale);
            tail.applyTransform();
            tail.transform.restore();
            this.tail.push(tail);
        }
        if (this.tail.length >= this.tailLength) this.tail.shift();
    }
    drawTail (cursor, alpha = 1) {
        cursor.save();
        const color = this.tailColor.clone();
        color.a *= alpha;
        cursor.strokeStyle = color.toString();
        cursor.lineCap = "round";
        cursor.lineWidth = this.tailScale * (2 * this.shape.radii.min());
        this.#drawTailPath(cursor);
        cursor.restore();
    }
    drawTailGlow (cursor, alpha = 1) {
        cursor.save();
        cursor.filter = `blur(${this.glowResolution}px)`;
        const color = this.glowColor.clone();
        color.a *= alpha;
        cursor.strokeStyle = color.toString();
        cursor.lineWidth = this.glowRadius;
        this.#drawTailPath(cursor);
        cursor.stroke();
        cursor.globalCompositeOperation = "destination-out";
        this.drawTail(cursor);
        cursor.globalCompositeOperation = "source-over";
        cursor.restore();
    }
    clone (deep = false) {
        const beam = super.clone(deep);
        beam.tailRadius = this.tailRadius;
        return beam;
    }

    get isBeam () { return true }
}
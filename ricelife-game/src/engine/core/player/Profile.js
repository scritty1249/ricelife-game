import { LoadImage } from "../load/LoadImage.js";
import { Loadable } from "../load/Loadable.js";
import { Vector } from "../math/Vector.js";
import { Color } from "../math/Color.js";

// discord profile related data (icon, display name)
// is responsible for drawing
export class Profile extends Loadable {
    #name;
    #avatar;
    #fontSize = 12;
    #fontFamily = "serif";
    #fontColor = new Color();
    #avatarOffset = new Vector();
    #nameOffset = new Vector();
    #userid; // Snowflake ID from discord. these are strings
    // String, LoadImage, String
    constructor (name, avatar, userid) {
        super();
        this.#name = name.trim();
        this.#avatar = avatar;
        this.#userid = userid;
    }

    getNameWidth (cursor) {
        cursor.save();
        cursor.font = this.font;
        const { width } = cursor.measureText(this.name);
        cursor.restore();
        return width;
    }
    draw (cursor, position) {
        this.drawName(cursor, position);
        this.drawAvatar(cursor, position);
    }
    drawName (cursor, position) {
        cursor.save();
        cursor.textAlign = "center";
        cursor.textBaseline = "middle";
        cursor.fillStyle = this.fontColor.toString();
        cursor.font = this.font;
        cursor.fillText(this.name, position.add(this.nameOffset));
        cursor.restore();
    }
    drawAvatar (cursor, position) {
        const { width, height } = this.avatar;
        const radius = width / 2;
        const offset = position.add(this.avatarOffset);
        const origin = offset.clone();
        offset.x -= radius;
        offset.y += height / 2;
        cursor.save();
        cursor.beginPath();
        cursor.arc(origin, radius, 0, Math.PI * 2, false);
        cursor.clip();
        this.avatar.draw(cursor, offset.x, offset.y);
        cursor.restore();
    }
    toJSON () {
        return {
            name: this.name,
            avatar: this.avatar?.isLoadImage ? this.avatar.source.src : this.avatar,
            fontFamily: this.fontFamily,
            userid: this.userid
        }
    }

    get isProfile () { return true }
    get ready () { return this.avatar.ready }
    get onload () { return this.avatar.onload.then(() => this) }
    get source () { return this.avatar.source }
    get name () { return this.#name }
    get avatar () { return this.#avatar }
    get nameOffset () { return this.#nameOffset }
    get avatarOffset () { return this.#avatarOffset }
    get fontColor () { return this.#fontColor }
    get fontSize () { return this.#fontSize }
    set fontSize (pixels) { return (this.#fontSize = pixels) }
    get fontFamily () { return this.#fontFamily }
    set fontFamily (font) { return (this.#fontFamily = font) }
    get font () { return `${this.fontSize}px ${this.fontFamily}` }
    get userid () { return this.#userid } // string - snowflake ID from discord
}

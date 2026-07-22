import { Vector, Color } from "../geometry/geometry.js";
import { LoadImage } from "../asset/asset.js";

// discord profile related data (icon, display name)
// is responsible for drawing
export class PlayerProfile {
    static fromObject (obj) {
        const img = new LoadImage(obj.avatar);
        const other = new PlayerProfile(obj.name, img, obj.userid);
        other.fontFamily = obj.fontFamily;
        return other;
    }
    #name;
    #avatar;
    #fontSize = 12;
    #fontFamily = "serif";
    #fontColor = new Color();
    #avatarOffset = new Vector();
    #nameOffset = new Vector();
    #userid; // Snowflake ID from discord. these are strings
    // String, LoadedImage
    constructor (name, avatar, userid) {
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
            avatar: this.avatar?.isLoadImage ? this.avatar.img.src : this.avatar,
            fontFamily: this.fontFamily,
            userid: this.userid
        }
    }

    get isPlayerProfile () { return true }
    get name () { return this.#name }
    get avatar () { return this.#avatar }
    get onload () { return this.avatar.onload.then(() => this) }
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

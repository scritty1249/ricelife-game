import { Menu, Vector } from "../../core/Core.js";
import { AmmoTypeSelection } from "../selections/AmmoTypeSelection.js";

export class AmmoSelect extends Menu {
    constructor (phase, drawBackgroundFn, ammoTypes) {
        super (phase, drawBackgroundFn);
        this.#load(ammoTypes)
            .then(() => this.resolveLoad());
    }
    // #computeTileLayout () {
    //     // create template tile
    //     const { MIN_TILE_SIZE, MAX_TILE_SIZE } = this.constructor.SETTINGS;
    //     const { tileSpacingScale } = this.constructor;
    //     const tileWidth = clamp(this.Global.Display.size.x / 2, MIN_TILE_SIZE, MAX_TILE_SIZE);
    //     const legLength = tileWidth / Math.sqrt(3);
    //     const padding = tileWidth * tileSpacingScale;
    //     const shape = new Equigon(6, legLength);
    //     shape.transformation.scale.y = 0.85;
    //     shape.applyTransformation();
    //     this.store.selectionShape = shape;
    //     // compute data for tile positioning and scaling
    //     let layers = 1;
    //     while (3 * layers * layers - 3 * layers + 1 < this.store.selections.length) layers++;
    //     this.store.tileRings = Math.max(5, --layers);
    //     this.store.tileCount = Math.max(37, (3 * layers)**2 - (3 * layers) + 1);
    //     this.store.tileSize = shape.globalTransformation.scale.clone();
    //     this.store.tileSize.x *= Math.sqrt(3) * shape.length;
    //     this.store.tileSize.y *= 1.5 * shape.length;
    //     this.store.tileSpace = this.store.tileSize.clone(); // padded size
    //     this.store.tileSpace.x += padding;
    //     this.store.tileSpace.y += (padding * 1.5 / Math.sqrt(3));
    //     this.store.tileTotalSpace = this.store.tileSpace.mul(this.store.tileRings * 2 - 1);
    //     this.store.tileHalfSpace = this.store.tileTotalSpace.div(2);
    //     this.store.tileRowSkew = this.store.tileRings * (this.store.tileSpace.x / 2);
    // }
}
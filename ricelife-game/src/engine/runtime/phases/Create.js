import {
    Phase,
    ItemLayout,
    Slider,
    ShapeButton,
    Circle,
    Color,
    Label
} from "../../core/Core.js";
import { MapSelect } from "../menus/MapSelect.js";
import { drawMenuItemRulers } from "../debug/draw.js";

// export class Create extends Phase {
//     static #selectedCallbackOptions = {
//         once: true
//     };
//     constructor (mainController, maps) {
//         super(mainController);
//         this.#init(maps)
//         this.#load()
//             .then(() => this.resolveLoad())
//             .catch((err) => this.rejectLoad(err));
//         this.onload.then(() => this.onResize());
//     }

//     #init (maps) {
//         this.Camera.Viewbox.bounding.left = this.Camera.Viewbox.bounding.right = false;
//         this.Menus.set("Maps", new MapSelect(this, maps));
//     }
//     async #load () {
//         this.store.menu = await this.Menus.get("Maps").onload;
//     }
//     #onMapSelected (selected) {
//         this.Events.raiseEvent("SELECTED", selected);
//     }

//     onanimate () {
//         const { menu } = this.store;
//         if (!menu?.isOpen) this.Camera.update();
//     }
//     start () {
//         // attach per start, consume on trigger. Prevent multiple map loads from being queued up at the same time
//         this.store.menu.Events.addEventListener("SELECTED", (data) => this.#onMapSelected(data), Create.#selectedCallbackOptions);
//         super.start();
//         this.store.menu.open();
//     }
//     reset () {
//         super.reset();
//         this.store.menu.close();
//     }
// }

export class Create extends Phase {
    constructor (mainController, maps) {
        super(mainController);
        this.#init(maps);
        this.#load()
            .then(() => this.resolveLoad())
            .catch((err) => this.rejectLoad(err));
    }

    #init (maps) {
        const buttons = new ItemLayout();
        {
            const label = new Label("Teams", 50, undefined, "serif", this.Global.Display.cursor);
            const slider = new Slider(new ShapeButton(new Circle(20), new Color(0, 0, 0, 1)), 10);
            slider.dotOffset.apply(slider.dot.width / 2, slider.dot.height / 2);
            slider.barWidth = 100;
            slider.barHeight = 20;
            buttons.push(label, slider);
        }
        {
            const slider = new Slider(new ShapeButton(new Circle(20), new Color(0, 0, 0, 1)), 10);

            slider.dotOffset.apply(slider.dot.width / 2, slider.dot.height / 2);
            slider.barWidth = 100;
            slider.barHeight = 20;
            slider.barCornerRadius = 5;
            buttons.push(slider);
        }
        {
            const slider = new Slider(new ShapeButton(new Circle(20), new Color(0, 0, 0, 1)), 10);

            slider.dotOffset.apply(slider.dot.width / 2, slider.dot.height / 2);
            slider.barWidth = 500;
            slider.barHeight = 20;
            slider.barCornerRadius = 10;
            buttons.push(slider);
        }

        buttons.isColumn = true;
        buttons.setPosition(500, 250);
        this.Interface.insert()
            .push(buttons)
            .fixed = true;
        this.store.buttons = buttons;
        this.Plane.max.apply(1000, 1000);
        this.Camera.Viewbox.bounding.left = this.Camera.Viewbox.bounding.right = false;
    }
    async #load () {
    }

    onanimate () {
        const { cursor } = this.Global.Display;
        this.Interface.draw(cursor);
        // [!] debug
        for (const item of this.store.buttons)
            drawMenuItemRulers(cursor, item, true);
        drawMenuItemRulers(cursor, this.store.buttons, true);
    }
}

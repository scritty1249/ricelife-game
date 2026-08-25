import {
    Phase,
    ItemLayout,
    Slider,
    ShapeButton,
    Circle,
    Color,
    Label,
    HexaButton
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
//     async ontick (delta) {
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
            .then(() => this.onResize())
            .then(() => this.resolveLoad())
            .catch((err) => this.rejectLoad(err));
    }

    #init (maps) {
        this.#setupInterface();
        this.Plane.max.apply(1000, 1000);
        this.Camera.Viewbox.bounding.left = this.Camera.Viewbox.bounding.right = false;
    }
    async #load () {
        
    }
    #setupInterface () {
        const buttons = new ItemLayout();
        buttons.isColumn = true;
        buttons.gap = 15;
        buttons.padding.apply(10);
        this.Interface.insert()
            .push(buttons)
            .fixed = true;
        this.store.buttons = buttons;
        this.store.styling = {
            dotColor: new Color(0, 0, 0, 1),
            dotRadius: 12,
            barColor: new Color(255, 255, 255, 1),
            barWidth: 250,
            barHeight: 8,
            barCornerRadius: 4,
            rowGap: 5
        };
        // [!] minimums on init
        this.store.values = {
            teamCount: 2,
            teamSize: 1,
        };
        this.#setupMapOptions();
        this.#setupTeamCountSlider();
        this.#setupTeamSizeSlider();
        this.#setupSubmitButton();
    }
    #setupMapOptions () {

    }
    #setupTeamCountSlider () {
        const { DEFAULT_FONT, FONT_SIZE } = this.Global.store;
        const { styling } = this.store;
        const label = new Label("Teams", FONT_SIZE * 2, undefined, DEFAULT_FONT.family, this.Global.Display.cursor);
        const row = new ItemLayout();
        const slider = new Slider(new ShapeButton(new Circle(styling.dotRadius), styling.dotColor), 4, this.store.values.teamCount);
        const value = new Label(slider.value, FONT_SIZE * 1.5, undefined, DEFAULT_FONT.family, this.Global.Display.cursor);
        slider.dotOffset.apply(slider.dot.width / 2, slider.dot.height / 2);
        slider.barColor.apply(styling.barColor);
        slider.barWidth = styling.barWidth;
        slider.barHeight = styling.barHeight;
        slider.barCornerRadius = styling.barCornerRadius;
        slider.onchange = () => value.text = this.store.values.teamCount = slider.value;
        row.gap = styling.rowGap;
        row.isColumn = false;
        row.push(slider, value);
        this.store.buttons.push(label, row);
    }
    #setupTeamSizeSlider () {
        const { DEFAULT_FONT, FONT_SIZE } = this.Global.store;
        const { styling } = this.store;
        const label = new Label("Team Size", FONT_SIZE * 2, undefined, DEFAULT_FONT.family, this.Global.Display.cursor);
        const row = new ItemLayout();
        const slider = new Slider(new ShapeButton(new Circle(styling.dotRadius), styling.dotColor), 5, this.store.values.teamSize);
        const value = new Label(slider.value, FONT_SIZE * 1.5, undefined, DEFAULT_FONT.family, this.Global.Display.cursor);
        slider.dotOffset.apply(slider.dot.width / 2, slider.dot.height / 2);
        slider.barColor.apply(styling.barColor);
        slider.barWidth = styling.barWidth;
        slider.barHeight = styling.barHeight;
        slider.barCornerRadius = styling.barCornerRadius;
        slider.onchange = () => value.text = this.store.values.teamSize = slider.value;
        row.gap = styling.rowGap;
        row.isColumn = false;
        row.push(slider, value);
        this.store.buttons.push(label, row);
    }
    #setupSubmitButton () {
        const { DEFAULT_FONT, FONT_SIZE } = this.Global.store;
        const { styling } = this.store;
        const button = new HexaButton(styling.dotRadius * 2, styling.barWidth * (1/4));
        const { width, height } = button.getBoundingBox();
        button.fontSize = FONT_SIZE;
        button.fontFamily = DEFAULT_FONT.family;
        button.originOffset.apply(-width / 2, height / 2);
        button.fillColor.apply(255, 255, 255, 1);
        button.fontColor.apply(0, 0, 0, 1);
        button.text = "Submit";
        button.onclick = () => {
            console.log(this.store.values.teamCount, this.store.values.teamSize);
        }
        this.store.buttons.push(button);
    }
    #drawDebugOverlay () {
        const { cursor } = this.Global.Display;
        drawMenuItemRulers(cursor, this.store.buttons, true, true);
    }

    onanimate () {
        const { cursor } = this.Global.Display;
        this.Interface.draw(cursor);
        if (this.Global.flags.DEBUG) this.#drawDebugOverlay();
    }
    onResize () {
        const { center } = this.Global.Display;
        const { buttons } = this.store;
        buttons.setPosition(center.x - (buttons.width / 2), center.y + (buttons.height / 2));
    }
    async ontick (delta) {
    }
}

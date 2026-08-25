import { IconButton } from "./IconButton.js";
import { Icon } from "./Icon.js";

export class ToggleIconButton extends IconButton {
    #icons = {
        active: undefined,
        inactive: undefined
    };
    #state = true;
    constructor (activeIcon, inactiveIcon) {
        super(activeIcon);
        this.#icons.active = activeIcon;
        this.#icons.inactive = inactiveIcon;
    }

    setPosition (x, y = null) {
        this.activeIcon.position.apply(x, y).sub(this.originOffset, true);
        this.inactiveIcon.position.apply(x, y).sub(this.originOffset, true);
    }
    toggle () { this.active = !this.active }

    get isToggleIconButton () { return true }
    get activeIcon () { return this.#icons.active }
    get inactiveIcon () { return this.#icons.inactive }
    get icon () { return this.active ? this.activeIcon : this.inactiveIcon }
    get active () { return this.#state }
    set active (bool) { return (this.#state = !!bool) }
}
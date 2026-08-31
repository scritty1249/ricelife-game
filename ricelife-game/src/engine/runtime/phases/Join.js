import {
    Phase,
    ItemLayout,
    Icon,
    HexaButton
} from "../../core/Core.js";
import { initLobby } from "../utils.js";
import { drawMenuItemRulers } from "../debug/draw.js";

export class Join extends Phase {
    #ClientPlayerID;
    #Lobby;
    constructor (mainController, playerID, lobbyData) {
        super(mainController);
        this.#ClientPlayerID = playerID;
        this.#Lobby = initLobby(lobbyData);
        this.#init();
        this.#load()
            .then(() => this.onResize())
            .then(() => this.resolveLoad())
            .catch((err) => this.rejectLoad(err));
    }

    #init () {
        this.Plane.max.apply(1000, 1000);
    }
    async #load () {
        await this.#loadLobby();
        this.#setupInterface();
    }
    async #loadLobby () {
        await this.Lobby.loadAvatarAssets(this.AssetPool, this.Global.constructor.AssetType.Image);
    }
    #setupInterface () {
        this.store.lobbyElements = new ItemLayout();
        this.store.lobbyElements.isColumn = true;
        this.store.teamLayouts = new ItemLayout();
        this.store.teamLayouts.gap = 15;
        const layout = new ItemLayout();
        for (const team of Object.values(this.Lobby.Teams)) {
            const teamLayout = new ItemLayout();
            teamLayout.gap = 5;
            for (const player of team) {
                const { avatar: key } = player.data.profile;
                const avatar = new Icon(this.AssetPool.get(key).clone(false));
                teamLayout.push(avatar);
            }
            this.store.teamLayouts.push(teamLayout);
        }
        layout.push(this.store.teamLayouts);
        this.store.lobbyElements.push(layout)
        if (this.isClientInLobby) this.store.lobbyElements.push(this.#createJoinButton());
        this.Interface.insert().push(this.store.lobbyElements).fixed = true;
    }
    #createJoinButton () {
        const { DEFAULT_FONT, FONT_SIZE } = this.Global.store;
        const button = new HexaButton(20, 60);
        const { width, height } = button.getBoundingBox();
        button.fontSize = FONT_SIZE;
        button.fontFamily = DEFAULT_FONT.family;
        button.originOffset.apply(-width / 2, height / 2);
        button.fillColor.apply(255, 255, 255, 1);
        button.fontColor.apply(0, 0, 0, 1);
        button.text = "Join";
        button.onclick = () => this.#onsubmit();
        return button;
    }
    #onsubmit () {
        if (!this.isClientInLobby) this.Events.raiseEvent("JOIN");
        else console.info("Cannot join lobby. Already a participant");
    }
    #drawDebugOverlay () {
        const { cursor } = this.Global.Display;
        drawMenuItemRulers(cursor, this.store.lobbyElements, true, true);
    }

    onanimate () {
        const { cursor } = this.Global.Display;
        this.Interface.draw(cursor);
        if (this.Global.flags.DEBUG) this.#drawDebugOverlay();
    }
    onResize () {
        const { isPortrait, center } = this.Global.Display;
        const { lobbyElements, teamLayouts } = this.store;
        const { bounding } = this.Camera.Viewbox;
        teamLayouts.isColumn = isPortrait;
        for (const teamLayout of teamLayouts.children) {
            teamLayout.isColumn = !isPortrait;
        }
        lobbyElements.setPosition(center.x - (lobbyElements.width / 2), center.y + (lobbyElements.height / 2));
        bounding.left = bounding.right = !isPortrait;
        bounding.top = bounding.bottom = isPortrait;
    }

    get Lobby () { return this.#Lobby }
    get ClientPlayerID () { return this.#ClientPlayerID }
    get isClientInLobby () { return this.Lobby.Players.has(this.ClientPlayerID) }
}
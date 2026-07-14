import { AmmoPool, LobbyJSON } from "../../lobby/lobby.js";
import { AnimationList, Animation, ShapeAnimation } from "../../animate/animate.js";
import { Vector, Color, Ray, BoundingBox } from "../../geometry/geometry.js";
import { PhaseController } from "./main.js";
import { SelectionController, ShotSelection } from "./select.js";
import { InputListener } from "../player.js";
import { ViewboxController } from "../display.js";
import { WorkerController } from "../workers.js";
import { drawBlastAnimation } from "../../projectile/projectile.js";
import { generateTerrain, generateWave } from "../../terrain/terrain.js";
import { WorkerPool } from "../../workers/workers.js";
import { Properties } from "../../projectile/projectile.js";
import { floatEqual } from "../../utils/utils.js";
import * as Menu from "../../menu/menu.js"

import { drawCircle, drawLine, drawMarker, drawText, wrapDeg, rad2deg, generateBitmapDownloadURL } from "../../utils/utils.js"; // [!] all for debug overlay

export class RoundController extends PhaseController {
    static SETTINGS = {
        BUSY_SECONDS_THRESHOLD: 1.5, // time in seconds before the "busy" screen pops up while tracing shots
        SHOT_TRACE_LIMIT: 30, // (seconds) will trigger a landing early if timeout is exceeded- however a landing will only be traced within this time frame so early landings shouldn't be happening... -KT
        AIM_SENSITIVITY: Math.PI / 180,
        POWER_SENSITIVITY: .005,
        PAN_SENSITIVITY: 5,
        MOVE_SPEED: 1,
        TERRAIN_EDGE: new Color("#00e8f0"),
        TERRAIN_FILL: new Color("#0098eb")
    };
    static INPUT_MAP = {
        Escape: "esc",
        KeyW: "mv+",
        KeyS: "mv-",
        KeyD: "pan+",
        KeyA: "pan-",
        ArrowRight: "aim-", // counterclockwise
        ArrowLeft: "aim+", // clockwise
        ArrowUp: "shot+", // increment shot power
        ArrowDown: "shot-", // deincrement shot power
        Space: "shootActive",
        Digit1: "shot1",
        Digit2: "shot2",
        Digit3: "shot3",
        Digit4: "shot4",
        Digit5: "shot5",
        Digit6: "shot6",
        Digit7: "shot7",
        Digit8: "shot8",
        Digit9: "shot9",
        Digit0: "shot10",
        ShiftLeft: "debug+",
        ShiftRight: "debug+"
    };
    #AmmoPool = new AmmoPool(new URL('.', import.meta.url).pathname + "../../projectile/types");
    #Plane;
    #LobbyData;
    #ActivePlayer;
    #Players;
    #Threaded;
    #Interface;
    #Terrain;
    #Camera;
    #SelectionPhase;
    #Animations = {
        Main: new AnimationList()
    };
    #loadPromise;
    constructor (mainController, lobbyData) {
        super(mainController);
        this.#init(lobbyData);
        this.#loadPromise = this.#load()
            .then(() => this.#setupSelectPhase())
            .then(() => this.#setupInterface())
            .then(() => {
                this.Global.Display.addResizeListener(this.#onResize);
                this.#onResize();
            })
            .then(() => this.#selectShot(this.store.shot.types[0]))
            .then(() => this.#setupSfx())
            .then(() => distributePlayers(this.Plane, this.Players)) // [!] temporary
            .then(() => this.setViewbox(this.ActivePlayer.tank.position))
            .then(() => this.state = this.constructor.STATES.Ready)
            .catch((err) => console.error(`[${this.constructor.name}]:`, err));
    }

    #init (lobby) {
        this.flags.isTurn = true;
        this.flags.SELECTING = false;
        this.store.prerender = Promise.resolve();
        this.store.lastViewbox = {
            size: new Vector(),
            center: new Vector(),
            set: false
        };
        this.store.cacheKey = {
            terrain: "lastTerrainState",
            background: "backgroundCanvas"
        };
        this.store.shot = {
            tracer: undefined,
            current: undefined,
            selected: undefined,
            map: undefined,
            types: undefined,
            impacts: [],
            // [!] for debug overlay
            legend: undefined,
            blasts: [],
            collisions: [],
        };
        this.#Camera = new ViewboxController(this.Global.Display.Viewbox);
        this.#Plane = new BoundingBox(undefined, this.Global.constructor.COORDINATE_PLANE_SIZE);
        this.#Interface = new Menu.Interface(this.Global.Display.Viewbox);
        this.Global.Input.keyMap = this.constructor.INPUT_MAP;
        this.Global.Input.pointerMap = this.Interface;
        this.#Threaded = new WorkerController(new WorkerPool(new URL(`../../workers/web-worker.js`, import.meta.url), 4, 3));
        this.#LobbyData = new LobbyJSON(lobby);
        this.store.shot.types = this.LobbyData.ammoTypes();
        this.store.shot.selected = this.store.shot.types.at(0);
        this.AmmoPool.add(...this.store.shot.types);
        this.#Players = Array.from(this.LobbyData.playerInstances());
        this.#ActivePlayer = this.Players.at(0);

        this.Audio.Layer.blast = this.Audio.Player.Layer();
        this.Audio.Layer.blast.volume = 0.55;
        this.Audio.Player.volume = 0.35;

        const { AssetTable } = this;
        // load player models
        for (const modelType of this.LobbyData.modelTypes()) {
            AssetTable[modelType + "/body"] = [this.Global.constructor.AssetType.Image, undefined, `./assets/tank/${modelType}/body.png`];
            AssetTable[modelType + "/barrel"] = [this.Global.constructor.AssetType.Image, undefined, `./assets/tank/${modelType}/barrel.png`];
            this.loadAsset(modelType + "/body");
            this.loadAsset(modelType + "/barrel");
        }
        // load interface assets
        for (const assetKey of ["fireBtn", "selectBtn", "shotType", "leftBtn", "rightBtn", "blast", "muzzleFlash", "explosion", "fire", "bouncer"]) {
            this.loadAsset(assetKey, ...this.Global.AssetTable[assetKey]);
        }
    }
    #setupSelectPhase () {
        const selections = [];
        for (const type of this.store.shot.types) {
            const selection = new ShotSelection(type);
            const typeConstructor = this.AmmoPool.get(type);
            selection.glowColor.apply(typeConstructor.glowColor);
            selection.glowColor.a = .8;
            selection.fontColor.apply(typeConstructor.mainColor);
            selection.fontColor.a = 1;
            selections.push(selection);
        }
        this.#SelectionPhase = new SelectionController(this.Global, selections);
        return this.SelectionPhase.onload;
    }
    #setShot (shot, map) {
        const { shot: st } = this.store;
        shot.setLegend(map.legend);
        st.current = shot;
        st.tracer = shot.getTracer();
        st.map = map;
        // for debug overlay
        st.legend = shot.getLegend(false);
        st.collisions = [];
        st.blasts = Array.from(map.blasts);
        for (const multi of st.legend)
            for (const legend of multi)
                for (const collision of legend.collisions)
                    st.collisions.push(collision);
    }
    #clearShot () {
        const { shot } = this.store;
        shot.current = undefined;
        shot.map = undefined;
        this.store.impacts = [];
        delete this.Animations.blasts;
        // [!] keep shot legend and collisions until next projectile is fired, these are for debug and should remain onscreen even after the shot is gone
    }
    #createMuzzleFlash (width) {
        const { ActivePlayer } = this;
        const sprite = this.AssetPool.get("muzzleFlash").clone();
        sprite.width = width;
        sprite.rotation = ActivePlayer.aimer.rotation + Math.PI;
        const ani = new Animation(ActivePlayer.tank.barrelPosition, sprite, sprite.framerate);
        ani.speed = 2.3;
        this.Animations.Main.push(ani);
        return ani;
    }
    #launchCallbackFactory () {
        const self = this;
        const createMuzzleFlash = this.#createMuzzleFlash.bind(this);
        return function () {
            const { tank, aimer } = self.ActivePlayer;
            const blastSizes = this.userData.hitbox
                ?.filter((blast) => blast?.shape?.isCircle)
                ?.map(({shape}) => shape.radii.length * 2) || [1];
            const blastAverageSize = blastSizes.reduce((a, b) => a + b) / blastSizes.length;
            const blastMagnitude = blastAverageSize / Math.max(tank.width, tank.height);
            const muzzleFlashSize = (blastMagnitude * 400) * (aimer.power**3);
            createMuzzleFlash(muzzleFlashSize).play(); // [!] may be more efficient to preload animations instead of generating them while showing projectile onscreen
            self.Audio.Player.add(self.AssetPool.get("fire").Instance().play(), true);
        }
    }
    #createPlayerDeathAnimation (player) {
        const { tank } = player;
        const sprite = this.AssetPool.get("explosion").clone();
        sprite.rotation = tank.rotation.body;
        const ani = new Animation(tank.relativePosition, sprite, sprite.framerate);
        this.Animations.Main.push(ani);
        return ani;
    }
    #createBlastAnimation (blast) {
        const ani = new ShapeAnimation(blast.shape.clone(), .6, 25, drawBlastAnimation);
        ani.speed = 1.25;
        return ani;
    }
    #applyBlastDamage (blast) {
        for (const Player of this.Players) {
            if (!Player.tank.getHitbox().isIntersecting(blast.shape)) continue;
            Player.hitpoints.damage(blast.damage);
            console.info(`[${this.constructor.name}]: Registered ${blast.damage} damage on ${Player.data.profile.name} from ${this.ActivePlayer.data.profile.name}`);
            if (Player.isDead) this.#createPlayerDeathAnimation(Player).play();
        }
    }
    #saveViewbox () {
        this.store.lastViewbox.size.apply(this.Global.Display.Viewbox.size);
        this.store.lastViewbox.center.apply(this.Global.Display.Viewbox.center);
        this.store.lastViewbox.set = true;
    }
    #preloadImpact (blastInterval) {
        const { AssetPool, Threaded } = this;
        const { Context, Layer } = this.Audio;
        const { background } = this.store.cacheKey;
        const { frame, delay, blasts, polygon } = blastInterval;
        // bundle callbacks with data to call later
        const impact = {
            triggered: false,
            frame: frame,
            time: delay,
            blasts: blasts,
            animations: new AnimationList(),
            play: function () {
                // update canvas
                Threaded.cache[background]?.close?.();
                Threaded.cache[background] = this.frame;
                this.animations.play();
                this.triggered = true;
            }
        };
        for (let i = 0; i < blasts.length; i++) {
            const blast = blasts.at(i);
            const blastBbox = blast.shape.getBoundingBox();
            const blastSize = blastBbox.size.length;
            // sound effects
            const bassNode = Context.newBassNode();
            bassNode.frequency.value = 200;
            bassNode.gain.value = (blastSize / 50)**3;
            const sfxLayer = Layer.blast.Layer([bassNode], true);
            const sfxNode = AssetPool.get("blast").Instance();
            sfxLayer.add(sfxNode); // [!] whole layer is already ephemeral so no need to apply to the instance
            // visual effects
            const ani = this.#createBlastAnimation(blast);
            // shift player positions
            ani.onstart.then(() => this.updateTerrain(polygon, [blastBbox]));
            // play sfx
            ani.onstart.then(() => sfxNode.play());
            // register damage
            if (blast.damage)
                ani.onstart.then(() => this.#applyBlastDamage(blast));
            impact.animations.push(ani);
        }
        return impact;
    }
    #drawDebugOverlay () {
        const { ActivePlayer, Terrain, Interface, store, flags } = this;
        const { Input, Display } = this.Global;
        const { Viewbox, cursor } = Display;
        const displaySize = Display.size;
        // draw any holes in terrain
        Viewbox.setCursor(cursor, true);
        cursor.save();
        cursor.strokeStyle = "red";
        cursor.lineWidth = 2;
        for (const hole of Terrain.holes) {
            cursor.save();
            hole.draw(cursor);
            cursor.stroke();
            cursor.restore();
        }
        cursor.restore();
        // draw player body and barrel positions
        drawCircle(cursor, ActivePlayer.tank.barrelPosition);
        drawCircle(cursor, new Vector(ActivePlayer.tank.position.x, ActivePlayer.tank.position.y), 5,  "green");
        { // draw terrain outline
            cursor.save();
            Terrain.draw(cursor);
            cursor.clip("evenodd"); 
            cursor.strokeStyle = "blue";
            cursor.lineWidth = 4;
            cursor.stroke(); 
            cursor.restore();
        }
        if (store.shot.legend) {
            // draw collision details
            if (store.shot.collisions) {
                const _lineLength = 35;
                const red = new Color(255, 0, 0, .5)
                    .toString();
                const green = new Color(0, 255, 0, .5)
                    .toString();
                const blue = new Color(0, 0, 255, .5)
                    .toString();
                store.shot.collisions.forEach(({position, point, resultVelocity, velocity, normal}) => {
                    drawCircle(cursor, position, 3, blue); // shot position during collision
                    drawLine(cursor, point, point.add(normal.normalize().mul(_lineLength)), 2, green); // normal
                    drawLine(cursor, point, point.add(velocity.normalize().mul(_lineLength)), 2, blue); // direction (incoming)
                    if (resultVelocity.length) drawLine(cursor, position, position.add(resultVelocity.normalize().mul(_lineLength)), 2, red); // reflection
                });
            }
            // draw blasts
            if (store.shot.blasts?.length) {
                const c = new Color(255, 165, 0, .15);
                cursor.save();
                cursor.fillStyle = c.toString();
                for (const { shape } of store.shot.blasts) {
                    shape.draw(cursor, true);
                    cursor.fill();
                }
                cursor.restore();
                c.a = 1;
                for (const { position } of store.shot.blasts) {
                    drawCircle(cursor, position, 3, c.toString());
                }
            }
        }
        {
            cursor.restore();
            // draw button hitboxes
            cursor.save();
            cursor.strokeStyle = "green";
            [...Interface].forEach(({items, fixed}) => items.forEach((item) => {
                if (item?.isButton) {
                    cursor.save();
                    cursor.fixed = fixed;
                    item.getBoundingBox().draw(cursor);
                    cursor.stroke();
                    cursor.restore();
                }
            }));
            cursor.restore();
            Viewbox.setCursor(cursor, true);
        }
        if ((Input.pointer.isActive
            && ActivePlayer.aimer.isOver(Input.pointer.origin))
            || Input.keyboard.keyActive("debug+")
        ) {
            const position = Viewbox.toGlobal(Input.pointer.position);
            const c = Terrain.isIntersecting(position) ? new Color(0, 200, 50, 1) : new Color(200, 200, 10, 1);
            drawCircle(cursor, position, 4, c);
            drawText(cursor, position, `${position.toString()}, (${wrapDeg(rad2deg(ActivePlayer.tank.barrelPosition.angle(position)).toFixed(0) - 90)})`, c.toString());
            c.a = .5;
            drawLine(cursor, ActivePlayer.tank.barrelPosition, position, 2, c.toString());
        }
        if (Input.keyboard.keyActive("debug+")) {
            {
                // draw Y-axis positioning raycasters
                const ray = new Ray(new Vector(ActivePlayer.tank.position.x, 0), Vector.fromAngle(Math.PI/2), displaySize.y - 20);
                drawCircle(cursor, ray.at(0), 7, "purple")
                drawCircle(cursor, ray.at(-1), 7, "white")
                Terrain.raycast(ray)
                    .toSorted((a, b) => b.point.y - a.point.y)
                    .forEach(({point, angle, entering}, i) => drawMarker(cursor, point, Vector.fromAngle(angle + Math.PI), 4, 20, entering ? "purple" : "white"));
            }
            // draw player hitboxes
            cursor.save();
            cursor.strokeStyle = "red";
            cursor.lineWidth = 2;
            for (const { tank, isDead } of this.Players)
                if (!isDead) {
                    tank.getHitbox().draw(cursor);
                    cursor.stroke();
                }
            cursor.restore();
            const position = Viewbox.toGlobal(Input.pointer.position);
            // stuff here may cause a lot of lag
            // draw raycast tester
            const mode = Input.keyboard.keyActive("shot1")
                ? 1 // only show hits from holes
                : Input.keyboard.keyActive("shot2")
                    ? 2 // only show hits from non-holes
                    : 0; // show all hits
            const hits = Terrain.raycast(new Ray(ActivePlayer.tank.barrelPosition, position))
                .filter(({hole}) => 
                    (mode === 0)
                    || (mode === 1 && hole)
                    || (mode === 2 && !hole));
            if (Input.keyboard.keyActive("shot3")) console.log(hits);
            cursor.save();
            cursor.strokeStyle = "orange";
            cursor.lineWidth = 3;
            for (let i = 0; i < hits.length; i++) {
                const { point, angle, entering, hole } = hits[i];
                const c = entering ? "purple" : "white";
                const offset = point.x > position.x
                    ? (3 * Math.PI) / 2
                    : Math.PI / 2;
                drawMarker(cursor, point, Vector.fromAngle(angle + offset), 4, 20, c);
                if (hits[i]?._path?.isPath) {
                    hits[i]._path.draw(cursor, true);
                    cursor.stroke();
                    drawCircle(cursor, hits[i]._path.at(0), 5, "orange");
                }
            }
            cursor.restore();
        }
        cursor.restore();
    }
    #onResize = () => {
        const { HUD } = this.store;
        const screen = this.Global.Display.getBoundingBox();
        const padX = screen.width * 0.04;
        const padY = screen.height * 0.14;
        HUD.fire.icon.source.height
            = HUD.select.icon.source.height
            = HUD.right.icon.source.height
            = HUD.left.icon.source.height
            = screen.height / 10;
        HUD.shot.icon.source.height = screen.height * 0.08;
        HUD.fire.setPosition(padX, padY);
        HUD.select.setPosition(HUD.fire.icon.width + (padX * 2), padY);
        HUD.shot.setPosition(HUD.select.getPosition().x + HUD.select.icon.width + padX, padY);
        HUD.right.setPosition(screen.width - HUD.right.icon.width - padX, padY);
        HUD.left.setPosition(HUD.right.getPosition().x - HUD.left.icon.width - (padX / 3), padY);
    }
    #setupInterface () {
        const { AssetPool, Interface, ActivePlayer, Global, store, flags } = this;
        const { MOVE_SPEED } = this.constructor.SETTINGS;
        const fireImg = AssetPool.get("fireBtn");
        const selectImg = AssetPool.get("selectBtn");
        const leftImg = AssetPool.get("leftBtn");
        const rightImg = AssetPool.get("rightBtn");
        const shotImg = AssetPool.get("shotType");

        const fireBtn = new Menu.IconButton(fireImg);
        const selectBtn = new Menu.IconButton(selectImg);
        const leftBtn = new Menu.IconButton(leftImg);
        const rightBtn = new Menu.IconButton(rightImg);
        const shotIco = new Menu.IconButton(shotImg); // don't make clickable
        const underButton = this.Global.Display.getBoundingBox().clone(); // don't make drawable

        this.store.HUD = {
            fire: fireBtn,
            select: selectBtn,
            left: leftBtn,
            right: rightBtn,
            shot: shotIco,
            under: underButton
        };

        shotIco.fontSize = 16;

        // setting up button callbacks
        rightBtn.onclick = rightBtn.onhold = () => ActivePlayer.mover.move(MOVE_SPEED);
        leftBtn.onclick = leftBtn.onhold = () => ActivePlayer.mover.move(-MOVE_SPEED);
        selectBtn.onclick = () => this.openSelect();
        fireBtn.onclick = () => {
            if (store.shot.current === undefined)
                this.launchShot();
        }
        underButton.id = true;
        underButton.isOver = underButton.isIntersecting;
        underButton.keepDragFocus = true;
        const panSensitivity = this.constructor.SETTINGS.PAN_SENSITIVITY / 5;
        underButton.ondrag = (point, origin, delta) => {
            this.untrackActivePlayer();
            this.Camera.focus = false;
            this.panViewbox(delta.mul(-panSensitivity).div(this.Global.Display.Viewbox.canvasScale, true));
        }
        underButton.onrelease = (point, delta) => {
        }
        underButton.onscroll = (point, delta) => {
            if (this.Global.Input.pointer.pointerCount < 2 && !floatEqual(delta.x, 0)) {
                this.untrackActivePlayer();
                this.Camera.focus = false;
                this.panViewbox(delta.x * panSensitivity);
            }
            if (!floatEqual(delta.y, 0)) {
                this.untrackActivePlayer();
                this.Camera.focus = false;
                const scale = 1 / ((this.Global.Display.size.y - delta.y) / this.Global.Display.size.y);
                if (scale < 1 && (this.Global.Display.Viewbox.canvasScale.x > this.Global.constructor.SETTINGS.MAX_VIEWBOX_SCALE || this.Global.Display.Viewbox.canvasScale.y > this.Global.constructor.SETTINGS.MAX_VIEWBOX_SCALE)) return;
                const size = this.Global.Display.Viewbox.size.clone();
                const pt = this.Global.Display.Viewbox.toGlobal(point);
                this.Global.Display.Viewbox.applyScale(scale);
                if (!size.eq(this.Global.Display.Viewbox.size))
                    this.setViewbox(pt);
            }
        }

        Interface.insert()
            .push(underButton)
            .fixed = true;
        Interface.insert() // draw layer zero after background but before terrain
            .push(ActivePlayer.aimer);
        Interface.insert()
            .push(fireBtn, selectBtn, rightBtn, leftBtn, shotIco)
            .fixed = true;
    }
    #setupSfx () {
        const { Player } = this.Audio;
        const { AssetPool, AmmoPool } = this;
        const bounceSfxFn = function () { Player.add(AssetPool.get("bouncer").Instance().play(), true); }
        AmmoPool.get("Bouncer").SFX.bounce = bounceSfxFn;
        AmmoPool.get("MegaBouncer").SFX.bounce = bounceSfxFn;
    }
    #selectShot (type) {
        this.store.shot.selected = type;
        this.store.HUD.shot.text = type;
    }
    #getSelectionBackground () {
        const { cursor } = this.Global.Display;
        const doScreenshot = this.SelectionPhase.constructor.backgroundFilter;
        this.store.selectPhaseBackground?.close?.();
        if (doScreenshot) {
            cursor.save();
            cursor.filter = this.SelectionPhase.constructor.backgroundFilter;
            this.animate(true);
            cursor.restore();
        }
        this.store.selectPhaseBackground = cursor.screenshot(false);
        if (doScreenshot) this.animate(true); // [!] may be redundant since this should always be called before switching to selection menu anyways...? -KT
    }
    async #preloadMap (map) {
        const { Audio, Threaded, Global, Animations, Terrain, store } = this;
        const { TERRAIN_EDGE, TERRAIN_FILL } = this.constructor.SETTINGS;
        const { blasts } = map; // should be sorted
        store.prerender = Threaded.drawBlastedTerrains(1, this.store.cacheKey.terrain, Global.Display.planeSize, {edge: TERRAIN_EDGE, fill: TERRAIN_FILL}, ...blasts);
        Animations.blasts = new AnimationList();
        store.shot.impacts = [];
        const blastIntervals = await store.prerender;
        for (const blastInterval of blastIntervals) {
            const impact = this.#preloadImpact(blastInterval)
            Animations.blasts.push(...impact.animations);
            store.shot.impacts.push(impact);
        }
        Animations.Main.push(...Animations.blasts);
    }
    async #load () {
        const { Global } = this;
        const { SETTINGS } = this.constructor;
        const { planeSize } = this.Global.Display;
        const Terrain = generateTerrain(
            generateWave(
                planeSize.x,
                Global.constructor.SETTINGS.RESOLUTION,
                (v) => v.y += planeSize.y * .35, .03, 40, 1.3, 15
            ), planeSize
        );
        await this.AssetPool.onload;
        const waitPromises = [];
        for (const Player of this.Players) {
            const team = Player.id === this.ActivePlayer.id
                ? "self" : Player.data.team === this.ActivePlayer.data.team
                    ? "ally" : "enemy";
            const modelType = `${Player.data.model.type}/${team}/`;
            waitPromises.push(Player.load(Terrain, this.AssetPool.get(modelType + "body"), this.AssetPool.get(modelType + "barrel"), Global.Display.cursor));
        }
        this.#Terrain = Terrain;
        await this.Threaded.onload;
        waitPromises.push(
            this.AmmoPool.onload,
            this.Threaded.createCache(this.store.cacheKey.background, "CANVAS", ...planeSize),
            this.Threaded.insertCache(this.store.cacheKey.terrain, "POLY", Terrain.Float64(1))
        );
        await Promise.all(waitPromises);
        await this.Threaded.drawTerrain(this.store.cacheKey.background, this.store.cacheKey.terrain, SETTINGS.TERRAIN_FILL, SETTINGS.TERRAIN_EDGE)
            .then(() => this.Threaded.updateCache(this.store.cacheKey.background));
        this.trackActivePlayer();
    }
    #drawBackground () {
        const img = this.Threaded.cache[this.store.cacheKey.background];
        const { Viewbox, cursor, size } = this.Global.Display;
        cursor.drawImage(img, Viewbox.min.x, cursor.normalizeY(Viewbox.max.y), Viewbox.width, Viewbox.height, 0, 0, size.x, size.y);
    }

    trackActivePlayer () {
        this.Camera.track(this.ActivePlayer.tank.position);
        this.Camera.lerpFactor = 0.2;
    }
    untrackActivePlayer () {
        this.Camera.untrack(this.ActivePlayer.tank.position);
        this.Camera.lerpFactor = 1;
    }
    // expects a shot to actually exist
    trackShot () {
        this.#saveViewbox();
        this.Camera.save();
        this.Camera.focus = true;
        this.Camera.lerpFactor = 0.12;
        this.Camera.track(this.ActivePlayer.tank.getBoundingBox(), ...this.store.shot.blasts.map(({shape}) => shape));
    }
    untrackShot () {
        this.Camera.restore();
        if (this.store.lastViewbox.set) {
            this.Camera.focus = false;
            this.Camera.follow(this.store.lastViewbox.center);
            this.Camera.setTargetSize(this.store.lastViewbox.size.x, this.store.lastViewbox.size.y, false);
            this.store.lastViewbox.set = false;
        }
    }
    setTurn (bool) {
        this.flags.isTurn = this.ActivePlayer.aimer.enabled = bool;
    }
    async launchShot () {
        const { ActivePlayer, AmmoPool, Global, store, flags } = this;
        this.setTurn(false);
        // [!] start timeout to dispatch busy event here
        // let wasSetBusy = false;
        // store.dispatchBusyTimeout = setTimeout(() => {
        //     wasSetBusy = true;
        //     config.dispatchEvent.busy();
        // }, config.busyThreshold);
        this.animate(true); // draw one last frame so the game doesn't look like it just froze
        const shot = this.createShot();
        const map = await this.Threaded.traceProjectile(
            this.getShotColliders(),
            shot,
            Global.TickInterval.interval / 1000,
            this.constructor.SETTINGS.SHOT_TRACE_LIMIT
        );
        if (map.blasts.length)
            this.#preloadMap(map);
        await store.prerender;
        // if (wasSetBusy) {
        //     config.dispatchEvent.ready();
        //     store.input.pointer.onNextClick()
        //         .then(() => setProjectile(store, projectile, landing));
        // } else {
        //     clearTimeout(store.dispatchBusyTimeout);
        //     setProjectile(store, projectile, landing);
        // }
        this.#setShot(shot, map);
        this.trackShot();
    }
    // sets viewbox to player
    setViewbox (x = undefined, y = undefined) {
        const { Viewbox } = this.Global.Display;
        const pos = Viewbox.getPosition();
        if (x?.isVector) pos.apply(x);
        else {
            if (Number.isFinite(x)) pos.x = x;
            if (Number.isFinite(y)) pos.y = y;
        }
        Viewbox.setPosition(pos);
    }
    // moves the viewbox
    panViewbox (x = undefined, y = undefined) {
        const { Viewbox } = this.Global.Display;
        const pos = Viewbox.getPosition();
        if (x?.isVector) pos.add(x, true);
        else {
            if (Number.isFinite(x)) pos.x += x;
            if (Number.isFinite(y)) pos.y += y;
        }
        Viewbox.setPosition(pos);
    }
    openSelect () {
        this.#getSelectionBackground();
        this.SelectionPhase.start();
        this.Global.Input.keyMap = {};
        this.Global.Input.pointerMap = this.SelectionPhase.Interface;
        this.flags.SELECTING = true;
    }
    closeSelect () {
        this.flags.SELECTING = false;
        if (this.SelectionPhase.store.SELECTED) this.#selectShot(this.SelectionPhase.store.SELECTED);
        this.SelectionPhase.reset();
        this.Global.Input.keyMap = this.constructor.INPUT_MAP;
        this.Global.Input.pointerMap = this.Interface;
        this.store.selectPhaseBackground?.close?.();
        this.store.selectPhaseBackground = undefined;
    }
    updateTerrain (polygon, changedBBoxes = []) {
        if (this.Terrain.hash !== polygon.hash)
            this.Terrain.apply(polygon);
        // if bboxes of changed areas are provided, only update player positions that lie within them.
        //  otherwise, update all player positions
        const Players = changedBBoxes?.length
            ? this.Players.filter(({tank}) => {
                const { position } = tank;
                return changedBBoxes.some((bbox) => bbox.isIntersecting(position));
            }) : this.Players;
        for (const { tank, mover } of Players) {
            // update positioning - account for "falling"
            tank.position.round(2);
            mover.apply(mover.position.x, mover.position.y);
        }
    }
    getPlayer (id) {
        for (const Player of this.Players)
            if (Player.id === id) return Player;
        return undefined;
    }
    createShot () {
        const { Global, AmmoPool, store } = this;
        const type = AmmoPool.get(store.shot.selected);
        const shot = new type(...this.getShotLaunchData());
        shot.colliders.push(store.terrain);
        shot.launchCallback = this.#launchCallbackFactory();
        shot.displayBoundingBox = Global.Display.Viewbox;
        return shot;
    }
    getShotColliders () {
        const { Players } = this;
        const colliders = [this.store.cacheKey.terrain];
        for (const Player of Players)
            if (!Player.isDead) {
                const playerHitbox = Player.tank.getHitbox().Polygon();
                playerHitbox.userData.collision = Properties.PLAYER | Properties.ENTER;
                playerHitbox.userData.position = Player.tank.position.round(2, true).toJSON();
                playerHitbox.userData.rotation = Player.tank.rotation.body;
                playerHitbox.userData.heightOffset = Player.tank.height + Player.mover.offsetY;
                colliders.push(playerHitbox)
            }
        return colliders;
    }
    // yields origin (Vector), angle (radians), power (Number 0-1)
    *getShotLaunchData () {
        const { ActivePlayer } = this;
        const { relativePosition, barrelPosition } = ActivePlayer.tank;
        const barrelPath = new Ray(relativePosition, barrelPosition);
        yield this.Terrain.raycast(barrelPath)
            .sort((a, b) => a.distance(relativePosition) - b.distance(relativePosition))
            .at(0) || barrelPosition;
        yield ActivePlayer.aimer.rotation + (3 * (Math.PI / 2));
        yield ActivePlayer.aimer.power;
    }
    handleInput () {
        const { ActivePlayer, Interface, Global, flags, store } = this;
        const { AIM_SENSITIVITY, MOVE_SPEED, POWER_SENSITIVITY, PAN_SENSITIVITY } = this.constructor.SETTINGS;
        const { keyboard, pointer } = Global.Input;
        if (keyboard.keyActive("esc")) {
            // pause menu logic
        }
        if (!keyboard.keyActive("debug+")) {
            if (keyboard.keyActive("pan+")) {
                this.untrackActivePlayer();
                this.Camera.focus = false;
                this.panViewbox(PAN_SENSITIVITY);
                
            }
            if (keyboard.keyActive("pan-")) {
                this.untrackActivePlayer();
                this.Camera.focus = false;
                this.panViewbox(-PAN_SENSITIVITY);
            }
        }
        if (flags.isTurn) {
            // [!] most pointer logic handled by callbacks

            // keyboard
            if (!keyboard.keyActive("debug+")) {
                if (store.shot.current === undefined) {
                    if (keyboard.keyActive("shootActive"))
                        this.launchShot()
                            .catch((error) => {
                                console.error(`[${this.constructor.name}]: Projectile trace error`);
                                throw error;
                            });
                }
                ActivePlayer.tank.position.round(1/Global.constructor.SETTINGS.RESOLUTION);
                if (keyboard.keyActive("mv+")) {
                    ActivePlayer.mover.move(MOVE_SPEED);
                    this.trackActivePlayer();
                }
                if (keyboard.keyActive("mv-")) {
                    ActivePlayer.mover.move(-MOVE_SPEED);
                    this.trackActivePlayer();
                }
                if (keyboard.keyActive("shot+")) {
                    ActivePlayer.aimer.power += POWER_SENSITIVITY;
                }
                if (keyboard.keyActive("shot-")) {
                    ActivePlayer.aimer.power -= POWER_SENSITIVITY;
                }
                if (keyboard.keyActive("aim+")) {
                    ActivePlayer.aimer.rotation += AIM_SENSITIVITY;
                }
                if (keyboard.keyActive("aim-")) {
                    ActivePlayer.aimer.rotation -= AIM_SENSITIVITY;
                }
            }
        } else {
            // only handle input related to menus (main menu, settings, exit button, etc.) - KT
            if (pointer.isActive) {
                if (pointer.isHolding)
                    this.Interface
                        .slice(0, 0) // only parse inputs for specific layers with the menu buttons (currently not implemented)
                        .onhold(pointer.position);
            }
        }
    }
    animate (clear = true) {
        const { ActivePlayer, Animations, Global, Interface, Threaded, Players, flags, store } = this;
        const { Viewbox, cursor } = Global.Display;
        cursor.save();
        if (clear) cursor.clear();
        if (flags.SELECTING) {
            if (this.store.selectPhaseBackground) {
                cursor.save();
                cursor.fixed = true;
                cursor.drawImage(this.store.selectPhaseBackground, 0, 0);
                cursor.restore();
            }
            this.SelectionPhase.animate(false);
        } else {
            // if (flags.isTurn) {
            //     Interface.draw(cursor, 0, 2);
            //     const { position } = ActivePlayer.tank;
            //     const { center } = Viewbox;
            //     if (flags.focusPlayer
            //         && position.x !== center.x
            //         && ((position.x - center.x < 0 && Viewbox.min.x > 0)
            //             || (position.x - center.x > 0 || Viewbox.max.x < Global.Display.planeSize.x)))
            //         this.setViewbox(position);
            // } else if (store.shot.current && !flags.isPanning) {
            //     this.#focusViewboxToShot();
            // }
            this.Camera.save();
            if (store.shot.current && this.Camera.tracking(this.ActivePlayer.tank.position)) {
                this.Camera.lerpFactor = 0.2;
                const shotBbox = store.shot.current.getBoundingBox(true, false, true);
                this.Camera.track(shotBbox.size.length ? shotBbox : undefined);
                this.Camera.focus = true;
            }
            this.Camera.update();
            this.Camera.restore();
            if (flags.isTurn) Interface.draw(cursor, 0, 2);
            Viewbox.setCursor(cursor, true);
            for (const { tank, isDead } of Players)
                if (!isDead) tank.draw(cursor);
            cursor.restore();
            this.#drawBackground();
            Viewbox.setCursor(cursor, true);
            if (store.shot.tracer) store.shot.tracer.draw(cursor);
            if (store.shot.current && store.shot.current.time > 0) store.shot.current.draw(cursor);
            Animations.Main.update(cursor);
            for (const Player of Players)
                Player.drawProfile(cursor);
            cursor.restore();
            if (flags.isTurn) Interface.draw(cursor, 2);
            if (Global.flags.DEBUG) this.#drawDebugOverlay();
        }
        cursor.restore();
    }
    async tick (delta) {
        const { Animations, Global, store, flags } = this;
        if (flags.SELECTING) {
            if (this.SelectionPhase.state === this.constructor.STATES.Raise) {
                this.closeSelect();
            } else {
                await this.SelectionPhase.tick(delta);
                return;
            }
        }
        if (store.shot.map?.intersect && (store.prerender?.isWorkerJob && !store.prerender.fulfilled)) { // wait for loading to finish before updating game loop
        } else { // do next tick / game update
            // check if background needs to be updated
            const blastAnimationsFinished = (!Animations.blasts || Animations.blasts.ended);
            const { map, current: shot } = store.shot;
            if (shot) {
                // trigger blast animations
                for (const impact of store.shot.impacts) {
                    if (impact.triggered) continue;
                    if (impact.time <= shot.time) impact.play();
                }
                // update projectile
                shot.update(delta / 1000);
                // are we done with projectile?
                const endProjectileEarly =
                    (shot.time >= this.constructor.SETTINGS.SHOT_TRACE_LIMIT) // time out shots even if a landing exists
                    || ((!map.finished || Animations.blasts.ended)
                        // time out early if theres no landing and it flew offscreen
                        //  or if all the blasts are done, and it flew offscreen
                        && !shot.isInsideDisplay);
                const isTimedout =
                    !(map.finished && shot.time >= map.time - Number.EPSILON)
                    && endProjectileEarly;

                if (endProjectileEarly) {
                    if (!blastAnimationsFinished) {
                        // play any paused blast animations prematurely
                        // shouldn't restart already playing animations
                        Animations.blasts?.play?.();
                    }
                    if (isTimedout) console.info(`[${this.constructor.name}]: Shot timed out`);
                    store.shot.current = undefined;
                }
                if ( // [!] could be written better
                    Animations.blasts?.ended
                    || (!Animations.blasts && isTimedout)
                ) {
                    await store.prerender;
                    this.untrackShot();
                    this.#clearShot();
                    // unlock player
                    this.setTurn(true);
                    store.prerender = Promise.resolve();
                }
            }
        }
        this.handleInput();
    }
    close () {
        this.state = this.constructor.STATES.Busy;
        this.Global.Display.removeResizeListener(this.#onResize);
        this.Threaded.terminate();
        super.close();
    }

    get isRoundController () { return true }
    get AmmoPool () { return this.#AmmoPool }
    get LobbyData () { return this.#LobbyData }
    get ActivePlayer () { return this.#ActivePlayer }
    get Players () { return this.#Players }
    get Threaded () { return this.#Threaded }
    get Interface () { return this.#Interface }
    get Terrain () { return this.#Terrain }
    get Animations () { return this.#Animations }
    get SelectionPhase () { return this.#SelectionPhase }
    get Camera () { return this.#Camera }
    get Plane () { return this.#Plane }
    get onload () { return this.#loadPromise }
}

function distributePlayers (bbox, players) {
    const min = bbox.min.x + (bbox.width / 10);
    const max = bbox.max.x - min;
    const spacing = (bbox.width / 6);
    const range = (max - min) / spacing; 
    const spots = new Set()
    for (const { aimer, mover } of players) {
        let x = undefined;
        while (x === undefined || spots.has(x)) {
            x = (Math.floor(Math.random() * (range + 1)) * spacing) + min;
        }
        spots.add(x);
        mover.apply(x, bbox.max.y + 1);
        aimer.update(players[0].tank.position.add({x: 0, y: bbox.max.y})); // aim straight up and set power to 100% (1)
    }
}

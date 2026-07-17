import { AmmoPool, LobbyJSON } from "../../lobby/lobby.js";
import { AnimationList, Animation, ShapeAnimation } from "../../animate/animate.js";
import { Vector, Color, Ray, BoundingBox } from "../../geometry/geometry.js";
import { PhaseController } from "./main.js";
import { SelectionController, ShotSelection } from "./select.js";
import { InputListener } from "../player.js";
import { ViewboxController } from "../display.js";
import { WorkerController } from "../workers.js";
import { drawBlastAnimation } from "../../projectile/projectile.js";
import { createTerrain, readTerrain } from "../../terrain/terrain.js";
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
        PLAYER_SCREEN_TRACKING_SCALE: 30, // scale to multiply player tank size by to use as target viewbox size when tracking player
        LOADING_PAUSE_THRESHOLD: 4 * 1000, // number of milliseconds before game waits for player input to play shot animation. If loading takes less time, shot animation is played automatically
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
    constructor (mainController, lobbySrc, terrainSrc) {
        super(mainController);
        this.#init();
        this.#loadPromise = this.#load(lobbySrc, terrainSrc)
            .then(() => this.#setupLobby())
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
            .then(() => this.trackActivePlayer())
            .then(() => this.state = this.constructor.STATES.Ready)
            .catch((err) => console.error(`[${this.constructor.name}]:`, err));
    }

    #init () {
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
        
        this.Audio.Layer.blast = this.Audio.Player.Layer();
        this.Audio.Layer.blast.volume = 0.55;
        this.Audio.Player.volume = 0.35;

        this.#Interface = new Menu.Interface();
        this.#setInputMap();

        this.#Threaded = new WorkerController(new WorkerPool(new URL(`../../workers/web-worker.js`, import.meta.url), 4, 3));
    }
    async #load (lobbySrc, terrainSrc) {
        const waitPromises = [];
        
        const interfacePromise = this.#loadInterface();
        const terrainPromise = this.#loadTerrain(terrainSrc);
        const lobbyPromise = this.#loadLobby(lobbySrc);

        waitPromises.push(Promise.all([lobbyPromise, terrainPromise]).then(() => {
            // load player instances
            const playerPromises = [];
            const fontFamily = this.Global.store.DEFAULT_FONT.family;
            const { Terrain, AssetPool } = this;
            const { cursor } = this.Global.Display;
            for (const Player of this.Players) {
                const team = Player.id === this.ActivePlayer.id
                    ? "self" : Player.data.team === this.ActivePlayer.data.team
                        ? "ally" : "enemy";
                const modelType = `${Player.data.model.type}/${team}/`;
                Player.data.profile.fontFamily = fontFamily; // set family before loading so we don't need to reapply styling
                playerPromises.push(Player.load(Terrain, AssetPool.get(modelType + "body"), AssetPool.get(modelType + "barrel"), cursor));
            }
            return Promise.all(playerPromises);
        }));
        waitPromises.push(Promise.all([terrainPromise, this.Threaded.onload]).then(() => {
            const { SETTINGS } = this.constructor;
            // draw the first terrain background
            return Promise.all([
                this.Threaded.createCache(this.store.cacheKey.background, "CANVAS", ...this.Plane.size),
                this.Threaded.insertCache(this.store.cacheKey.terrain, "POLY", this.Terrain.Float64(1))
            ])
            .then(() =>
                this.Threaded.drawTerrain(this.store.cacheKey.background, this.store.cacheKey.terrain, SETTINGS.TERRAIN_FILL, SETTINGS.TERRAIN_EDGE))
            .then(() =>
                this.Threaded.updateCache(this.store.cacheKey.background));
        }));
        await Promise.all(waitPromises);
    }
    async #loadTerrain (terrainSrc) {
        const iterator = await readTerrain(terrainSrc);
        const { plane, terrain } = createTerrain(iterator);
        this.#Plane = plane;
        this.#Terrain = terrain;
        this.Global.Display.cursor.planeSize.apply(plane.size);
    }
    async #loadLobby (lobbySrc) {
        const waitPromises = [];
        // load lobby data
        const response = await fetch(lobbySrc);
        const lobby = await response.json();
        this.#LobbyData = new LobbyJSON(lobby);

        // set instances
        this.store.shot.types = this.LobbyData.ammoTypes();
        this.store.shot.selected = this.store.shot.types.at(0);
        this.#Players = Array.from(this.LobbyData.playerInstances());
        this.#ActivePlayer = this.Players.at(0);

        // load ammo assets
        this.AmmoPool.add(...this.store.shot.types);
        waitPromises.push(this.AmmoPool.onload);

        // load player models
        const { AssetTable } = this;
        const { AssetType } = this.Global.constructor;
        for (const modelType of this.LobbyData.modelTypes()) {
            AssetTable[modelType + "/body"] = [AssetType.Image, undefined, `./assets/tank/${modelType}/body.png`];
            AssetTable[modelType + "/barrel"] = [AssetType.Image, undefined, `./assets/tank/${modelType}/barrel.png`];
            waitPromises.push(
                this.loadAsset(modelType + "/body"),
                this.loadAsset(modelType + "/barrel")
            );
        }

        await Promise.all(waitPromises);
    }
    async #loadInterface () {
        const interfaceAssets = ["fireBtn", "selectBtn", "shotType", "leftBtn", "rightBtn", "blast", "muzzleFlash", "explosion", "fire", "bouncer"];
        await Promise.all(interfaceAssets.map((assetKey) =>
            this.loadAsset(assetKey, ...this.Global.AssetTable[assetKey])));
    }
    #setupLobby () {
        this.#Camera = new ViewboxController(this.Global.Display, this.Plane.size);
        this.Interface.Viewbox = this.Camera.Viewbox;
    }
    #setupSelectPhase () {
        const selections = [];
        for (const type of this.store.shot.types) {
            const selection = new ShotSelection(type);
            const typeConstructor = this.AmmoPool.get(type);
            selection.fontFamily = this.Global.store.DEFAULT_FONT.family;
            selection.glowColor.apply(typeConstructor.glowColor);
            selection.glowColor.a = .8;
            selection.fontColor.apply(typeConstructor.mainColor);
            selection.fontColor.a = 1;
            selections.push(selection);
        }
        this.#SelectionPhase = new SelectionController(this.Global, selections);
        return this.SelectionPhase.onload;
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
            this.panViewbox(delta.mul(-panSensitivity).div(this.Camera.Viewbox.canvasScale, true));
        }
        underButton.onrelease = (point, delta) => {
        }
        underButton.onscroll = (point, delta) => {
            const { Viewbox } = this.Camera;
            if (this.Global.Input.pointer.pointerCount < 2 && !floatEqual(delta.x, 0)) {
                this.untrackActivePlayer();
                this.panViewbox(delta.x * panSensitivity);
            }
            if (!floatEqual(delta.y, 0)) {
                const { MAX_VIEWBOX_SCALE } = this.Global.constructor.SETTINGS;
                const { size: displaySize } = this.Global.Display;
                const { canvasScale } = Viewbox;
                this.untrackActivePlayer();
                const scale = 1 / ((displaySize.y - delta.y) / displaySize.y);
                if (scale < 1 && (canvasScale.x > MAX_VIEWBOX_SCALE || canvasScale.y > MAX_VIEWBOX_SCALE)) return;
                const size = Viewbox.size;
                const pt = Viewbox.toGlobal(point);
                Viewbox.applyScale(scale);
                this.Camera.save();
                Viewbox.save();
                this.Camera.update();
                const doPan = !size.eq(Viewbox.size);
                Viewbox.restore();
                this.Camera.restore();
                if (doPan) this.lerpViewbox(pt, undefined, .4);
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
    #setInputMap () {
        this.Global.Input.keyMap = this.constructor.INPUT_MAP;
        this.Global.Input.pointerMap = this.Interface;
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
        this.store.lastViewbox.size.apply(this.Camera.Viewbox.size);
        this.store.lastViewbox.center.apply(this.Camera.Viewbox.center);
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
            const blastSize = blastBbox.extent;
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
        const { Viewbox } = this.Camera;
        const { cursor } = Display;
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
        if (this.flags.SELECTING) {
            this.#getSelectionBackground(true);
        }
    }
    #selectShot (type) {
        this.store.shot.selected = type;
        this.store.HUD.shot.text = type;
    }
    #getSelectionBackground (preserveCanvas = false) {
        this.state = this.constructor.STATES.Busy;
        const { cursor } = this.Global.Display;
        this.store.selectPhaseBackground?.close?.();
        this.store.selectPhaseBackground = undefined;
        let original;
        cursor.save();
        if (preserveCanvas) {
            original = cursor.screenshot(false);
        }
        cursor.filter = this.SelectionPhase.constructor.backgroundFilter;
        this.flags.SELECTING = false;
        this.animate(true);
        this.flags.SELECTING = true;
        this.store.selectPhaseBackground = cursor.screenshot(false);
        if (preserveCanvas) {
            cursor.fixed = true;
            cursor.drawImage(original, 0, 0);
            original.close();
        }
        cursor.restore();
        this.state = this.constructor.STATES.Ready;
    }
    async #preloadMap (map) {
        const { Audio, Threaded, Plane, Animations, Terrain, store } = this;
        const { TERRAIN_EDGE, TERRAIN_FILL } = this.constructor.SETTINGS;
        const { blasts } = map; // should be sorted
        store.prerender = Threaded.drawBlastedTerrains(1, this.store.cacheKey.terrain, Plane.size, {edge: TERRAIN_EDGE, fill: TERRAIN_FILL}, ...blasts);
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
    #drawBackground () {
        const img = this.Threaded.cache[this.store.cacheKey.background];
        const { cursor, size } = this.Global.Display;
        const { Viewbox } = this.Camera;
        cursor.drawImage(img, Viewbox.min.x, cursor.normalizeY(Viewbox.max.y), Viewbox.width, Viewbox.height, 0, 0, size.x, size.y);
    }

    trackActivePlayer () {
        const { PLAYER_SCREEN_TRACKING_SCALE } = this.constructor.SETTINGS;
        const { tank } = this.ActivePlayer;
        this.Camera.unfollowAll();
        this.Camera.track(tank.position);
        this.Camera.setTargetSize(PLAYER_SCREEN_TRACKING_SCALE * tank.width, PLAYER_SCREEN_TRACKING_SCALE * tank.height, true);
        this.Camera.scalingBehavior = this.#Camera.constructor.SCALING_BEHAVIOR.Always;
        this.Camera.lerpFactor = 0.2;
    }
    untrackActivePlayer () {
        this.Camera.untrack(this.ActivePlayer.tank.position);
        this.Camera.setTargetSize(0, 0, true);
        this.Camera.scalingBehavior = this.#Camera.constructor.SCALING_BEHAVIOR.Grow;
        this.Camera.lerpFactor = 1;
    }
    // expects a shot to actually exist
    trackShot () {
        this.Camera.save();
        this.#saveViewbox();
        this.Camera.lerpFactor = 0.12;
        this.Camera.track(this.ActivePlayer.tank.getBoundingBox(), ...this.store.shot.blasts.map(({shape}) => shape));
    }
    untrackShot () {
        this.Camera.restore();
        if (this.store.lastViewbox.set) {
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
        const { LOADING_PAUSE_THRESHOLD } = this.constructor.SETTINGS;
        this.setTurn(false);
        this.animate(true); // draw one last frame so the game doesn't look like it just froze
        const shot = this.createShot();
        const totalStart = performance.now();
        let waitStart = performance.now();
        console.info(`[${this.constructor.name}]: Tracing shot - ${store.shot.selected}`);
        const map = await this.Threaded.traceProjectile(
            this.getShotColliders(),
            shot,
            Global.TickInterval.interval / 1000,
            this.constructor.SETTINGS.SHOT_TRACE_LIMIT
        );
        if (this.Global.flags.DEBUG)
            console.info(`[${this.constructor.name}]: Shot trace finished in ${(performance.now() - waitStart) / 1000} seconds`);
        waitStart = performance.now();
        console.info(`[${this.constructor.name}]: Rendering shot collisions`);
        if (map.blasts.length)
            this.#preloadMap(map);
        await store.prerender;
        if (this.Global.flags.DEBUG)
            console.info(`[${this.constructor.name}]: Collision map loaded in ${(performance.now() - waitStart) / 1000} seconds`);
        console.info(`[${this.constructor.name}]: Shot playback ready`);
        if (performance.now() - totalStart > LOADING_PAUSE_THRESHOLD) {
            console.info(`[${this.constructor.name}]: Awaiting click event`);
            await this.Global.Input.pointer.onNextClick();
        }
        console.info(`[${this.constructor.name}]: Playing shot animation`);
        this.#setShot(shot, map);
        this.trackShot();
    }
    // sets viewbox to player
    setViewbox (x = undefined, y = undefined) {
        const { Viewbox } = this.Camera;
        const pos = Viewbox.getPosition();
        if (x?.isVector) pos.apply(x);
        else {
            if (Number.isFinite(x)) pos.x = x;
            if (Number.isFinite(y)) pos.y = y;
        }
        Viewbox.setPosition(pos);
    }
    // moves the viewbox (additive)
    panViewbox (x = undefined, y = undefined) {
        const { Viewbox } = this.Camera;
        const pos = Viewbox.getPosition();
        if (x?.isVector) pos.add(x, true);
        else {
            if (Number.isFinite(x)) pos.x += x;
            if (Number.isFinite(y)) pos.y += y;
        }
        Viewbox.setPosition(pos);
    }
    // moves the viewbox by some factor
    lerpViewbox (x = undefined, y = undefined, factor = 1) {
        const { Viewbox } = this.Camera;
        const pos = Viewbox.getPosition();
        if (x?.isVector) pos.apply(x);
        else {
            if (Number.isFinite(x)) pos.x = x;
            if (Number.isFinite(y)) pos.y = y;
        }
        Viewbox.setPosition(Viewbox.getPosition().lerp(pos, factor, true));
    }
    openSelect () {
        this.#getSelectionBackground(false);
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
        const { Camera, AmmoPool, store } = this;
        const type = AmmoPool.get(store.shot.selected);
        const shot = new type(...this.getShotLaunchData());
        shot.colliders.push(store.terrain);
        shot.launchCallback = this.#launchCallbackFactory();
        shot.displayBoundingBox = Camera.Viewbox;
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
        const hit = this.Terrain.raycast(barrelPath)
            .sort((a, b) => a.distance(relativePosition) - b.distance(relativePosition))
            .at(0);
        yield hit?.point || barrelPosition;
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
                this.panViewbox(PAN_SENSITIVITY);
                
            }
            if (keyboard.keyActive("pan-")) {
                this.untrackActivePlayer();
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
        const { ActivePlayer, Camera, Animations, Interface, Threaded, Players, flags, store } = this;
        const { cursor } = this.Global.Display;
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
            if (store.shot.current && this.Camera.tracking(this.ActivePlayer.tank.position)) {
                const shotBbox = store.shot.current.getBoundingBox(true, false, true);
                Camera.follow(shotBbox.extentSquared ? shotBbox : undefined);
            }
            Camera.update();
            if (flags.isTurn) Interface.draw(cursor, 0, 2);
            Camera.Viewbox.setCursor(cursor, true);
            for (const { tank, isDead } of Players)
                if (!isDead) tank.draw(cursor);
            cursor.restore();
            this.#drawBackground();
            Camera.Viewbox.setCursor(cursor, true);
            if (store.shot.tracer) store.shot.tracer.draw(cursor);
            if (store.shot.current && store.shot.current.time > 0) store.shot.current.draw(cursor);
            Animations.Main.update(cursor);
            for (const Player of Players)
                Player.drawProfile(cursor);
            cursor.restore();
            if (flags.isTurn) Interface.draw(cursor, 2);
            if (this.Global.flags.DEBUG) this.#drawDebugOverlay();
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
        } else { // game update
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
                    if (this.Global.flags.DEBUG) console.info(`[${this.constructor.name}]: Shot playback finished`);
                    store.prerender = Promise.resolve();
                }
            }
        }
        // disable aimer if it covers enough of the screen
        const aimerIsLarge = this.Camera.Viewbox.size.max() / 2 <= this.ActivePlayer.aimer.radius * 2;
        let aimerIsCenter = this.ActivePlayer.aimer.isOver(this.Camera.Viewbox.toGlobal(this.Global.Display.getBoundingBox().center));
        if (!this.ActivePlayer.aimer.enabled) aimerIsCenter = !aimerIsCenter;
        this.ActivePlayer.aimer.enabled = this.flags.isTurn && !(aimerIsLarge && aimerIsCenter);
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

// [!] recursion limit applies per-player
function distributePlayers (bbox, players, recursionLimit = 10000) {
    const min = bbox.min.x + (bbox.width / 10);
    const max = bbox.max.x - min;
    const spacing = (bbox.width / players.length);
    const range = (max - min) / spacing; 
    const spots = new Set()
    for (const { aimer, mover } of players) {
        let x;
        let added = false;
        let i = 0;
        while (i < recursionLimit) {
            x = (Math.floor(Math.random() * (range + 1)) * spacing) + min;
            if (!spots.has(x) && mover.apply(x, bbox.max.y + 1)) {
                spots.add(x);
                added = true;
                break;
            }
            i++;
        }
        if (!added && i >= recursionLimit) throw new Error("Recusion limit reached while distributing players. Is terrain invalid?");
        aimer.update(players[0].tank.position.add({x: 0, y: bbox.max.y})); // aim straight up and set power to 100% (1)
    }
}

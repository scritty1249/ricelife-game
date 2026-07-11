import { AmmoPool, LobbyJSON } from "../../lobby/lobby.js";
import { AnimationList, Animation, ShapeAnimation } from "../../animate/animate.js";
import { Vector, Color, Ray } from "../../geometry/geometry.js";
import { PhaseController } from "./main.js";
import { SelectionController, ShotSelection } from "./select.js";
import { InputListener } from "../player.js";
import { WorkerController } from "../workers.js";
import { drawBlastAnimation } from "../../projectile/projectile.js";
import { generateTerrain, generateWave } from "../../terrain/terrain.js";
import { WorkerPool } from "../../workers/workers.js";
import { Properties } from "../../projectile/projectile.js";
import * as Menu from "../../menu/menu.js"

import { drawCircle, drawLine, drawMarker, drawText, wrapDeg, rad2deg } from "../../utils/utils.js"; // [!] all for debug overlay

export class RoundController extends PhaseController {
    static SETTINGS = {
        BUSY_SECONDS_THRESHOLD: 1.5, // time in seconds before the "busy" screen pops up while tracing shots
        SHOT_TRACE_LIMIT: 30, // (seconds) will trigger a landing early if timeout is exceeded- however a landing will only be traced within this time frame so early landings shouldn't be happening... -KT
        GROUND: 350,
        AIM_SENSITIVITY: Math.PI / 180,
        POWER_SENSITIVITY: .005,
        MOVE_SPEED: 1,
        TERRAIN_EDGE: new Color("#00e8f0"),
        TERRAIN_FILL: new Color("#0098eb")
    };
    static INPUT_MAP = {
        Escape: "esc",
        KeyW: "mv+",
        KeyS: "mv-",
        KeyD: "mv+",
        KeyA: "mv-",
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
    #LobbyData;
    #ActivePlayer;
    #Players;
    #Threaded;
    #Interface;
    #Terrain;
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
            .then(() => this.#selectShot(this.store.shot.types[0]))
            .then(() => this.#setupSfx())
            .then(() => distributePlayers(this.Global.Display.size, this.Players)) // [!] temporary
            .then(() => this.state = this.constructor.STATES.Ready)
            .catch((err) => console.error(`[${this.constructor.name}]:`, err));
    }

    #init (lobby) {
        this.flags.isTurn = true;
        this.flags.SELECTING = false;
        this.store.prerender = Promise.resolve();
        this.store.cacheKey = {
            terrain: "lastTerrainState",
            background: "backgroundCanvas"
        };
        this.store.shot = {
            tracer: undefined,
            current: undefined,
            legend: undefined,
            selected: undefined,
            map: undefined,
            types: undefined,
            impacts: [],
        };

        this.#Interface = new Menu.Interface();
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
        // load interface assets\
        for (const assetKey of ["fireBtn", "selectBtn", "shotType", "leftBtn", "rightBtn", "blast", "muzzleFlash", "explosion", "fire", "bouncer"]) {
            this.loadAsset(assetKey, ...this.Global.AssetTable[assetKey]);
        }
    }
    #setupSelectPhase () {
        const selections = [];
        for (const type of this.store.shot.types) {
            const selection = new ShotSelection(type);
            selection.glowColor.apply(255, 0, 0, .6);
            selections.push(selection);
        }
        this.#SelectionPhase = new SelectionController(this.Global, selections);
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
        const { cursor } = Display;
        const displaySize = Display.size;
        // draw any holes in terrain
        for (const hole of Terrain.holes) {
            cursor.save();
            hole.draw(cursor);
            cursor.strokeStyle = "red";
            cursor.lineWidth = 2;
            cursor.stroke();
            cursor.restore();
        }
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
        if (store.shot.map) {
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
                    drawLine(cursor, position, position.add(resultVelocity.normalize().mul(_lineLength)), 2, red); // reflection
                });
            }
            // draw blasts
            if (store.shot.map.blasts?.length) {
                const c = new Color(255, 165, 0, .15);
                cursor.save();
                cursor.fillStyle = c.toString();
                for (const { shape } of store.shot.map.blasts) {
                    shape.draw(cursor, true);
                    cursor.fill();
                }
                cursor.restore();
                c.a = 1;
                for (const { position } of store.shot.map.blasts) {
                    drawCircle(cursor, position, 3, c.toString());
                }
            }
        }
        {
            // draw button hitboxes
            cursor.save();
            cursor.strokeStyle = "green";
            [...Interface].forEach(({items}) => items.forEach((item) => {
                if (item?.isButton) {
                    item.getBoundingBox().draw(cursor);
                    cursor.stroke();
                }
            }));
            cursor.restore();
        }
        if ((Input.pointer.isDragging
            && ActivePlayer.aimer.isOver(Input.pointer.dragStart))
            || Input.keyboard.keyActive("debug+")
        ) {
            const { position } = Input.pointer;
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
            const { position } = Input.pointer;
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
    }
    #setupInterface () {
        const { AssetPool, Interface, ActivePlayer, store } = this;
        const { MOVE_SPEED } = this.constructor.SETTINGS;
        const fireImg = AssetPool.get("fireBtn");
        const selectImg = AssetPool.get("selectBtn");
        const leftImg = AssetPool.get("leftBtn");
        const rightImg = AssetPool.get("rightBtn");
        const shotImg = AssetPool.get("shotType");

        fireImg.height = 100;
        selectImg.height = 100;
        rightImg.height = 100;
        leftImg.height = 100;
        shotImg.height = 80;

        const fireBtn = new Menu.IconButton(fireImg);
        const selectBtn = new Menu.IconButton(selectImg);
        const leftBtn = new Menu.IconButton(leftImg);
        const rightBtn = new Menu.IconButton(rightImg);
        const shotIco = new Menu.IconButton(shotImg); // dont make clickable

        fireBtn.setPosition(75, 150);
        selectBtn.setPosition(300, 150);
        rightBtn.setPosition(this.Global.Display.size.x - rightImg.width - 75, 150);
        leftBtn.setPosition(rightBtn.getPosition().x - leftImg.width - 25, 150);
        shotIco.setPosition(520, 150);
        shotIco.fontSize = 16;
        this.store.shotIcon = shotIco;

        // setting up button callbacks
        rightBtn.onclick = rightBtn.onhold = () => ActivePlayer.mover.move(MOVE_SPEED);
        leftBtn.onclick = leftBtn.onhold = () => ActivePlayer.mover.move(-MOVE_SPEED);
        selectBtn.onclick = () => this.openSelect();
        fireBtn.onclick = () => {
            if (store.shot.current === undefined)
                this.launchShot();
        }

        Interface.insert() // draw layer zero after background but before terrain
            .push(ActivePlayer.aimer);
        Interface.insert()
            .push(fireBtn, selectBtn, rightBtn, leftBtn, shotIco);
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
        this.store.shotIcon.text = type;
    }
    #getSelectionBackground () {
        const { cursor } = this.Global.Display;
        const doScreenshot = this.SelectionPhase.constructor.backgroundFilter;
        this.store.snapshot?.close?.();
        if (doScreenshot) {
            cursor.save();
            cursor.filter = this.SelectionPhase.constructor.backgroundFilter;
            this.animate(true);
            cursor.restore();
        }
        this.store.snapshot = cursor.screenshot(false);
        if (doScreenshot) this.animate(true); // [!] may be redundant since this should always be called before switching to selection menu anyways...? -KT
    }
    async #preloadMap (map) {
        const { Audio, Threaded, Global, Animations, Terrain, store } = this;
        const { TERRAIN_EDGE, TERRAIN_FILL } = this.constructor.SETTINGS;
        const { blasts } = map; // should be sorted
        store.prerender = Threaded.drawBlastedTerrains(1, this.store.cacheKey.terrain, Global.Display.size, {edge: TERRAIN_EDGE, fill: TERRAIN_FILL}, ...blasts);
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
        const Terrain = generateTerrain(
            generateWave(
                Global.Display.size.x,
                Global.constructor.SETTINGS.RESOLUTION,
                (v) => v.y += SETTINGS.GROUND, .03, 40, 1.3, 15
            ), Global.Display.size
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
            this.Threaded.createCache(this.store.cacheKey.background, "CANVAS", ...this.Global.Display.size),
            this.Threaded.insertCache(this.store.cacheKey.terrain, "POLY", Terrain.Float64(1))
        );
        await Promise.all(waitPromises);
        await this.Threaded.drawTerrain(this.store.cacheKey.background, this.store.cacheKey.terrain, SETTINGS.TERRAIN_FILL, SETTINGS.TERRAIN_EDGE)
            .then(() => this.Threaded.updateCache(this.store.cacheKey.background));
    }

    async launchShot () {
        const { ActivePlayer, AmmoPool, Global, store, flags } = this;
        flags.isTurn = false;
        this.Global.Input.enabled = false;
        // [!] start timeout to dispatch busy event here
        // let wasSetBusy = false;
        // store.dispatchBusyTimeout = setTimeout(() => {
        //     wasSetBusy = true;
        //     config.dispatchEvent.busy();
        // }, config.busyThreshold);
        this.animate(); // draw one last frame so the game doesn't look like it just froze
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
        this.store.snapshot?.close?.();
        this.store.snapshot = undefined;
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
        shot.displayBoundingBox = Global.Display.getBoundingBox();
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
        const { AIM_SENSITIVITY, MOVE_SPEED, POWER_SENSITIVITY } = this.constructor.SETTINGS;
        const { keyboard, pointer } = Global.Input;
        if (keyboard.keyActive("esc")) {
            // pause menu logic
        }
        if (flags.isTurn) {
            // [!] most pointer logic handled by callbacks
            if (pointer.isActive) {
                // pointer
                if (pointer.isHolding)
                    Interface.onhold(pointer.position);
            }
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
                }
                if (keyboard.keyActive("mv-")) {
                    ActivePlayer.mover.move(-MOVE_SPEED);
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
        const { cursor } = Global.Display;
        if (clear) cursor.clear();
        if (flags.SELECTING) {
            cursor.drawImage(this.store.snapshot, 0, 0);
            this.SelectionPhase.animate(false);
        } else {
            if (flags.isTurn) Interface.draw(cursor, 0, 1);
            for (const { tank, isDead } of Players)
                if (!isDead) tank.draw(cursor);
            cursor.drawImage(Threaded.cache[store.cacheKey.background], 0, 0);
            if (store.shot.tracer) store.shot.tracer.draw(cursor);
            if (store.shot.current && store.shot.current.time > 0) store.shot.current.draw(cursor);
            Animations.Main.update(cursor);
            for (const Player of Players)
                Player.drawProfile(cursor);
            if (flags.isTurn) Interface.draw(cursor, 1);
            if (Global.flags.DEBUG) this.#drawDebugOverlay();
            
        }
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
                    this.#clearShot();
                    // unlock player
                    flags.isTurn = true;
                    this.Global.Input.enabled = true;
                    store.prerender = Promise.resolve();
                }
            }
        }
        this.handleInput();
    }
    close () {
        this.state = this.constructor.STATES.Busy;
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
    get onload () { return this.#loadPromise }
}

function distributePlayers (displaySize, players) {
    const min = displaySize.x / 10;
    const max = displaySize.x - min;
    const spacing = (displaySize.x / 6);
    const range = (max - min) / spacing; 
    const spots = new Set()
    let x = undefined;
    for (const { aimer, mover } of players) {
        while (x === undefined || spots.has(x)) {
            x = (Math.floor(Math.random() * (range + 1)) * spacing) + min;
        }
        spots.add(x);
        mover.apply(x, displaySize.y + 1);
        aimer.update(players[0].tank.position.add({x: 0, y: displaySize.y})); // aim straight up and set power to 100% (1)
    }
}

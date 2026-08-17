import {
    AmmoPool,
    AnimationList,
    Animation,
    ShapeAnimation,
    Vector,
    Color,
    Ray,
    equals,
    BoundingBox,
    Camera,
    drawBlastAnimation,
    IconButton,
    Lobby,
    Phase,
    Actor,
    Model,
    Metadata,
    Profile,
    Puppet,
    ScreenButton,
    KeyMap,
    typeString,
    BlastImpact
} from "../../core/Core.js"

import { WorkerPool, PoolManager, TerrainCache, CanvasCache } from "../../workers/Core.js";
import { AmmoSelect } from "../menus/AmmoSelect.js";
import { AmmoTypeDetails } from "../selections/AmmoTypeDetails.js";
import { HitpointMap } from "../../hitpoints/Core.js";
import { initTerrain, initLobby } from "../utils.js";

import { drawCircle, drawLine, drawMarker, drawText, generateBitmapDownloadURL } from "../debug/draw.js"; // [!] all for debug overlay

const INPUT_MAP = new KeyMap({
    "esc": ["Escape"],
    "mv+": ["KeyW"],
    "mv-": ["KeyS"],
    "pan+": ["KeyD"],
    "pan-": ["KeyA"],
    "aim-": ["ArrowRight"], // counterclockwise
    "aim+": ["ArrowLeft"], // clockwise
    "shot+": ["ArrowUp"], // increment shot power
    "shot-": ["ArrowDown"], // deincrement shot power
    "shootActive": ["Space"],
    "shot1": ["Digit1"],
    "shot2": ["Digit2"],
    "shot3": ["Digit3"],
    "shot4": ["Digit4"],
    "shot5": ["Digit5"],
    "shot6": ["Digit6"],
    "shot7": ["Digit7"],
    "shot8": ["Digit8"],
    "shot9": ["Digit9"],
    "shot10": ["Digit0"],
    "debug+": ["ShiftLeft"],
    "replay": ["ShiftRight"],
});

const LOADING_PAUSE_THRESHOLD = 4 * 1000; // number of milliseconds before game waits for player input to play shot animation. If loading takes less time, shot animation is played automatically
const SHOT_TRACE_LIMIT = 30; // (seconds) will trigger a landing early if timeout is exceeded- however a landing will only be traced within this time frame so early landings shouldn't be happening... -KT
const AIM_SENSITIVITY = Math.PI / 180;
const POWER_SENSITIVITY = .005;
const PAN_SENSITIVITY = 5;
const MOVE_SPEED = 1;

export class Round extends Phase {
    static MENU_BACKGROUND_TINT = new Color(0, 0, 0, .7);
    static WEB_WORKER_PATH = "/engine/workers/Worker.js";
    #AmmoPool = new AmmoPool("/engine/ammotypes");
    #Players = new Map();
    #Lobby;
    #ClientPlayerID; // id of client player
    #Threaded;
    #Terrain;
    #Animations = {
        Main: new AnimationList()
    };
    constructor (mainController, playerID, lobbyData, terrainData, distribute = false) {
        super(mainController);

        this.#Lobby = initLobby(lobbyData);
        this.#Terrain = initTerrain(terrainData);
        // [!] testing
        this.Terrain.apply(undefined, {
            edgeColor: new Color("#00e8f0"),
            fillColor: new Color("#0098eb")
        });
        this.Plane.max.apply(this.Terrain.polygon.getBoundingBox().width, this.Terrain.polygon.getBoundingBox().height * 2);

        this.#load(playerID)
            .then(() => this.#init())
            .then(() => !distribute || distributePlayers(this.Plane, Array.from(this.Players.values()), 100))
            .then(() => this.resolveLoad())
            .catch((error) => this.rejectLoad(error));
    }

    #init () {
        this.store.MIN_SIZE = this.Global.Display.size.div(5);
        this.store.prerender = Promise.resolve();
        this.store.ammo = {
            tracer: undefined,
            current: undefined,
            selected: undefined,
            map: undefined,
            types: undefined,
            impacts: [],
            debug: {
                legend: undefined,
                blasts: [],
                collisions: [],
            }            
        };
        this.store.turn = {}; // save turn info to be replayed or exported
        this.Audio.Layer.blast = this.Audio.Player.Layer();
        this.Audio.Layer.blast.volume = 0.55;
        this.Audio.Player.volume = 0.35;

        this.Camera.Viewbox.bounding.top = false;

        this.#setupInterface();
        this.Menus.set("Ammo", new AmmoSelect(this, this.#createAmmoSelections()));
        this.Menus.get("Ammo").Events.addEventListener("CLOSE", ({selection}) => {
            if (!selection?.isAmmoTypeDetails) return;
            this.store.ammo.selected = selection.id;
            this.store.overlayItems.launchButton.hide = false;
        })
    }
    async #load (playerID) {
        const waitPromises = [
            this.#setupThreads(),
            this.#loadLobby(playerID),
            this.loadGlobalAsset("blast"),
            this.loadGlobalAsset("muzzleFlash"),
            this.loadGlobalAsset("fire"),
            this.loadGlobalAsset("moveBtn"),
            this.loadGlobalAsset("selectBtn"),
            this.loadGlobalAsset("fireBtn"),
            this.loadGlobalAsset("replayBtn"),
        ];
        await Promise.all(waitPromises);
    }
    async #loadLobby (playerID) {
        this.#ClientPlayerID = playerID;
        await this.Lobby.loadAssets(
            this.#ClientPlayerID,
            this.AssetPool,
            this.AmmoPool,
            this.Global.constructor.AssetType
        );
        this.Lobby.generatePlayerActors(this.#ClientPlayerID, this.AssetPool, this.Players, HitpointMap, this.Terrain);
        await Promise.all(this.Players.values().map(({onload}) => onload));
    }
    #createAmmoSelections () {
        return Array.from(this.Lobby.AmmoTypes, (ammoType) => {
            const ammo = this.AmmoPool.get(ammoType);
            const selection = new AmmoTypeDetails(ammo.NAME, ammo.IMPORT, ); // [!] needs icon
            const { glowColor, borderColor, fillColor, fontColor } = selection;
            borderColor.apply(ammo.mainColor);
            fontColor.apply(glowColor.apply(ammo.glowColor));
            fillColor.apply(0, 0, 0, .6);
            return selection;
        });
    }
    async #setupThreads () {
        const pool = new WorkerPool(new URL(this.constructor.WEB_WORKER_PATH, window.location.origin), 4, 3);
        await pool.onload;
        this.#Threaded = new PoolManager(pool);
        this.store.cacheKey = {
            terrain: "lastTerrainState",
            background: "backgroundCanvas"
        };
        const terrain = new TerrainCache(this.Terrain, this.store.cacheKey.terrain);
        const background = new CanvasCache(this.Plane.width, this.Plane.height, this.store.cacheKey.background);
        await Promise.all([
            this.Threaded.setCache(background),
            this.Threaded.setCache(terrain)
        ]);
        await this.Threaded.drawTerrain(this.store.cacheKey.background, this.store.cacheKey.terrain);
        await this.Threaded.updateCache(this.store.cacheKey.background, true);
    }
    #setupInterface () {
        // panning/zoom controls
        const underButton = new ScreenButton(this.Global.Display);
        underButton.ondrag = (point, origin, delta, isTouch) => {
            this.Camera.unlock();
            this.Camera.offsetPosition(delta
                .mul(-PAN_SENSITIVITY)
                .div(this.Camera.Viewbox.canvasScale, true)
            );
        }
        underButton.onscroll = (point, delta, isTouch) => {
            const hasDeltaX = !equals(delta.x, 0);
            const hasDeltaY = !equals(delta.y, 0);
            if (!isTouch && hasDeltaX) {
                this.Camera.unlock();
                this.Camera.offsetPosition(delta.x * PAN_SENSITIVITY);
            }
            if (hasDeltaY) {
                const { size } = this.Global.Display;
                this.Camera.clearTargetSize();
                const scale = 1 / ((size.y - delta.y) / size.y);
                this.Camera.Viewbox.applyScale(scale);
            }
        }
        // UI
        const moveImg = this.AssetPool.get("moveBtn"); // left-facing
        const selectImg = this.AssetPool.get("selectBtn");
        const fireImg = this.AssetPool.get("fireBtn");
        const replayImg = this.AssetPool.get("replayBtn");
        const moveLeftBtn = new IconButton(moveImg.clone(false));
        const moveRightBtn = new IconButton(moveImg.clone(false));
        moveRightBtn.icon.source.scale.apply(-1, 1);
        moveRightBtn.icon.source.origin.apply(moveImg.rawSize.x, 0);
        const launchButton = new IconButton(fireImg.clone(false));
        const selectButton = new IconButton(selectImg.clone(false));
        const replayButton = new IconButton(replayImg.clone(false));

        const { Mover, Aimer, Puppet } = this.ClientPlayer;
        const { Camera, store, flags } = this;
        const { keyboard } = this.Global.Input;
        moveLeftBtn.onclick = moveLeftBtn.onhold = () => {
            if (flags.isTurn) {
                Mover.move(-MOVE_SPEED);
                this.trackClientPlayer();
            }
        };
        moveRightBtn.onclick = moveRightBtn.onhold = () => {
            if (flags.isTurn) {
                Mover.move(MOVE_SPEED);
                this.trackClientPlayer();
            }
        };
        launchButton.onclick = () => {
            if (flags.isTurn && store.ammo.current === undefined && store.ammo.selected)
                this.launchAmmo()
                    .catch((error) => {
                        console.error(`[${typeString(this)}]: Projectile trace error`);
                        throw error;
                    });
        };
        selectButton.onclick = () => {
            if (flags.isTurn)
                this.Menus.get("Ammo").open();
        };
        replayButton.onclick = () => {
            if (flags.isTurn && store.turn?.isRoundTurn) {
                replayButton.hide = true;
                this.animateTurn(store.turn);
            }
        };

        launchButton.hide = true;
        replayButton.hide = true;
        this.store.overlayItems = {
            moveLeftBtn,
            moveRightBtn,
            launchButton,
            selectButton,
            replayButton
        };
        this.Interface.insert()
            .push(underButton)
            .fixed = true;
        // player Aimer
        this.Interface.insert()
            .push(this.ClientPlayer.Aimer)
            .fixed = false;
        // overlay buttons
        this.Interface.insert()
            .push(...Object.values(this.store.overlayItems))
            .fixed = true;
        this.resizeOverlay();
    }
    #setupSFX () {
        const { AmmoPool, Audio } = this;
        const bounceSFXAmmoTypes = ["Bouncer", "MegaBouncer"];
        const bounceSFXCallback = function () {
            Player.add(AssetPool.get("bouncer").Instance().play(), true);
        }
        for (const ammoType of bounceSFXAmmoTypes) {
            if (AmmoPool.has(ammoType))
                AmmoPool.get(ammoType).SFX.bounce = bounceSFXCallback;
        }
    }
    #setAmmo (ammoType, map) {
        const { ammo } = this.store;
        ammoType.setLegend(map.legend);
        ammo.current = ammoType;
        ammo.map = map;
        ammo.tracer = ammoType.getTracer();
        ammo.debug.legend = ammoType.getLegend(false);
        ammo.debug.blasts = Array.from(map.blasts);
        ammo.debug.collisions = [];
        for (const multishotLegend of ammo.debug.legend.stages)
            for (const shotLegend of multishotLegend)
                for (const collision of shotLegend.collisions)
                    ammo.debug.collisions.push(collision);
    }
    #unsetAmmo () {
        const { ammo } = this.store;
        ammo.current = undefined;
        ammo.map = undefined;
        ammo.impacts = [];
        delete this.Animations.blasts;
    }
    #createLaunchCallback () {
        const self = this;
        // gets bound to Shot
        return function () {
            const { Puppet, Aimer } = self.ClientPlayer;
            const blastSizes = this.userData.hitbox
                ?.filter((blast) => blast?.shape?.isCircle)
                ?.map(({shape}) => shape.radii.length * 2) || [1];
            const blastAverageSize = blastSizes.reduce((a, b) => a + b) / blastSizes.length;
            const blastMagnitude = blastAverageSize / Math.max(Puppet.width, Puppet.height);
            const muzzleFlashSize = (blastMagnitude * 400) * (Aimer.power**3);
            const muzzleFlash = createMuzzleFlashAnimation(
                self.ClientPlayer,
                self.AssetPool.get("muzzleFlash").clone(),
                muzzleFlashSize
            );
            self.Animations.Main.push(muzzleFlash);
            muzzleFlash.play();
            self.Audio.Player.add(self.AssetPool.get("fire").Instance().play(), true);
        }
    }
    #preloadImpact (blastInterval) {
        const { AssetPool, Threaded } = this;
        const { Context, Layer } = this.Audio;
        const { background } = this.store.cacheKey;
        // bundle callbacks with data to call later
        const impact = new BlastImpact(
            Context,
            Layer.blast,
            AssetPool.get("blast"),
            blastInterval,
            createBlastAnimation
        );
        impact.ontrigger.then(({
            frame, terrain, bboxes, blasts, animations, combinedbbox
        }) => {
            Threaded.cache[background] = frame;
            animations.play();
            this.updateTerrain(terrain, true, bboxes);
            for (const blast of blasts)
                this.#applyBlastDamage(blast, this.ClientPlayer);
            if (this.Camera.targets)
                this.Camera.track(combinedbbox);
        });
        return impact;
    }
    async #preloadTurn (ammo, map) {
        const { Threaded, Plane, store } = this;
        const { blasts } = map; // should be sorted
        store.prerender = blasts?.length
            ? Threaded.renderBlastIntervals(this.store.cacheKey.terrain, Plane.size, ...blasts)
            : Promise.resolve([]);
        // save turn info
        // if (store.turn?.isRoundTurn) store.turn.close(); // [!] TODO: GC these
        store.turn = new RoundTurn(await store.prerender, this.Players.values(), this.Terrain.clone(true), ammo, Threaded.cache[store.cacheKey.background], map);
    }
    #loadBlastIntervals (intervals) {
        const { Animations, store } = this;
        Animations.blasts = new AnimationList();
        store.ammo.impacts = [];
        for (const interval of intervals) {
            const impact = this.#preloadImpact(interval)
            Animations.blasts.push(...impact.Animations);
            store.ammo.impacts.push(impact);
        }
        Animations.Main.push(...Animations.blasts);
    }
    #applyBlastDamage (blast, sourcePlayer) {
        for (const player of this.Players.values()) {
            if (!blast.damage || !player.Puppet.getHitbox().isIntersecting(blast.shape)) continue;
            player.HitTotal.damage(blast.damage);
            const targetName = player.Metadata.Profile.name;
            const sourceName = sourcePlayer?.Metadata?.Profile?.name || "unknown";
            console.info(`[${typeString(this)}]: Registered ${blast.damage} damage on ${targetName} from ${sourceName}`);
            if (player.isDead) {
                const deathExplosion = createPlayerDeathAnimation(
                    player,
                    this.AssetPool.get("explosion").clone()
                );
                this.Animations.Main.push(deathExplosion);
                deathExplosion.play();
            }
        }
    }

    async ontick (delta) {
        const { Animations, Global, store } = this;
        if (store.ammo.map?.intersect && (store.prerender?.isWorkerJob && !store.prerender.fulfilled)) {
            // wait for loading to finish before updating
        } else {
            // game update
            if (store.ammo.current) {
                if (this.updateAmmoTick(delta)) {
                    this.#unsetAmmo();
                    console.info(`[${typeString(this)}]: Shot playback finished`);
                    store.prerender = Promise.resolve([]);
                    // unlock player
                    this.store.overlayItems.replayButton.hide = false;
                    setTimeout(() => this.setTurn(true), 1000);
                    // check if round ended
                    //this.checkRoundEnd();
                }
            }
        }
        // disable Aimer if it covers enough of the screen
        const AimerIsLarge = this.Camera.Viewbox.size.max() / 2 <= this.ClientPlayer.Aimer.radius * 2;
        let AimerIsCenter = this.ClientPlayer.Aimer.isOver(this.Camera.Viewbox.toGlobal(this.Global.Display.getBoundingBox().center));
        if (!this.ClientPlayer.Aimer.enabled) AimerIsCenter = !AimerIsCenter;
        this.ClientPlayer.Aimer.enabled = this.flags.isTurn && !(AimerIsLarge && AimerIsCenter);
        this.handleInput();
    }
    start () {
        this.setTurn(this.Lobby.ActivePlayerID === this.#ClientPlayerID);
        super.start();
    }
    onanimate () {
        const { ClientPlayer, Camera, Animations, Interface, Threaded, Players, flags, store } = this;
        const { cursor } = this.Global.Display;
        if (store.ammo.current && Camera.tracking(ClientPlayer.Puppet.position)) {
            const shotBbox = store.ammo.current.getBoundingBox(true, false, true);
            Camera.follow(shotBbox.extentSquared ? shotBbox : undefined);
        }
        Camera.update();
        if (Camera.Viewbox.size.lengthSquared < store.MIN_SIZE.lengthSquared) {
            Camera.Viewbox.applySize(store.MIN_SIZE);
        }
        if (flags.isTurn) Interface.draw(cursor, 0, 2);
        Camera.Viewbox.setCursor(cursor, true);
        for (const player of Players.values())
            if (!player.isDead) player.drawModel(cursor);
        cursor.restore();
        this.drawBackground();
        Camera.Viewbox.setCursor(cursor, true);
        if (store.ammo.tracer) store.ammo.tracer.draw(cursor);
        if (store.ammo.current && store.ammo.current.time > 0)
            store.ammo.current.draw(cursor);
        Animations.Main.update(cursor);
        for (const player of Players.values())
            player.drawOverlay(cursor, player.id === this.#ClientPlayerID, flags.isTurn);
        cursor.restore();
        if (flags.isTurn) Interface.draw(cursor, 2);
        if (this.Global.flags.DEBUG) this.drawDebugOverlay();
    }
    onResize () {
        this.store.MIN_SIZE = this.Global.Display.size.div(5);
        this.resizeOverlay();
        this.setTurn(this.flags.isTurn);
        super.onResize();
    }
    resizeOverlay () {
        const { Display } = this.Global;
        const { size } = Display;
        const {
            moveLeftBtn,
            moveRightBtn,
            launchButton,
            selectButton,
            replayButton
        } = this.store.overlayItems;
        const padding = size.min() / 20;
        const targetWidth = size.x / 10
        moveRightBtn.icon.source.width
            = moveLeftBtn.icon.source.width
            = launchButton.icon.source.width
            = selectButton.icon.source.width
            = Math.min(250, targetWidth);
        replayButton.icon.source.width = Math.min(100, targetWidth);

        const baselineY = moveRightBtn.height + padding;
        if (Display.isPortrait) {
            moveLeftBtn.setPosition(
                padding,
                baselineY
            );
            moveRightBtn.setPosition(
                size.x - (moveRightBtn.width + padding),
                baselineY
            );
            launchButton.setPosition(
                (size.x / 2) - (padding / 2) - launchButton.width,
                baselineY
            );
            selectButton.setPosition(
                (size.x / 2) + (padding / 2),
                baselineY
            );
        } else {
            selectButton.setPosition(
                padding,
                baselineY
            );
            launchButton.setPosition(
                moveLeftBtn.width + padding + padding,
                baselineY
            );
            moveRightBtn.setPosition(
                size.x - (selectButton.width + padding),
                baselineY
            );
            moveLeftBtn.setPosition(
                size.x - (selectButton.width + launchButton.width + padding + padding),
                baselineY
            );
        }
        replayButton.setPosition(
            size.x - (replayButton.width + padding),
            size.y - padding
        );
    }
    drawDebugOverlay () {
        const { ClientPlayer, Terrain, Interface, store, flags } = this;
        const { Input, Display } = this.Global;
        const { Viewbox } = this.Camera;
        const { cursor } = Display;
        const displaySize = Display.size;
        // draw any holes in terrain
        Viewbox.setCursor(cursor, true);

        // terrain outline
        cursor.save();
        cursor.strokeStyle = "blue";
        cursor.lineWidth = 3;
        Terrain.polygon.draw(cursor, true);
        cursor.stroke();
        cursor.restore();

        // terrain holes
        cursor.save();
        cursor.strokeStyle = "yellow";
        cursor.lineWidth = 2;
        for (const hole of Terrain.polygon.holes) {
            cursor.save();
            hole.draw(cursor);
            cursor.stroke();
            cursor.restore();
        }
        cursor.restore();

        // player hitboxes
        cursor.save();
        cursor.strokeStyle = "red";
        cursor.lineWidth = 2;
        for (const { Puppet } of this.Players.values()) {
            cursor.save();
            Puppet.getHitbox()
                .draw(cursor, true);
            cursor.stroke();
            cursor.restore();
        }
        cursor.restore();

        // draw collision details
        if (store.ammo.debug.legend?.stages) {
            if (store.ammo.debug.collisions) {
                const _lineLength = 35;
                const red = new Color(255, 0, 0, .5)
                    .toString();
                const green = new Color(0, 255, 0, .5)
                    .toString();
                const blue = new Color(0, 0, 255, .5)
                    .toString();
                store.ammo.debug.collisions.forEach(({position, point, resultVelocity, velocity, normal}) => {
                    drawCircle(cursor, position, 3, blue); // shot position during collision
                    drawLine(cursor, point, point.add(normal.normalize().mul(_lineLength)), 2, green); // normal
                    drawLine(cursor, point, point.add(velocity.normalize().mul(_lineLength)), 2, blue); // direction (incoming)
                    if (resultVelocity.length) drawLine(cursor, position, position.add(resultVelocity.normalize().mul(_lineLength)), 2, red); // reflection
                });
            }
            // draw blasts
            if (store.ammo.debug.blasts?.length) {
                const c = new Color(255, 165, 0, .15);
                cursor.save();
                cursor.fillStyle = c.toString();
                for (const { shape } of store.ammo.debug.blasts) {
                    shape.draw(cursor, true);
                    cursor.fill();
                }
                cursor.restore();
                c.a = 1;
                for (const { position } of store.ammo.debug.blasts) {
                    drawCircle(cursor, position, 3, c.toString());
                }
            }
        }

        // draw UI button areas
        cursor.restore();
        cursor.save();
        cursor.fixed = true;
        cursor.strokeStyle = "red";
        cursor.lineWidth = 2;
        for (const item of Object.values(this.store.overlayItems)) {
            cursor.save();
            item.getBoundingBox?.()?.draw?.(cursor);
            cursor.stroke();
            cursor.restore();
        }
        cursor.restore();
    }
    trackClientPlayer (breadthScale = 10) {
        const { Camera } = this;
        const { Puppet } = this.ClientPlayer;
        Camera.track(Puppet.position);
        const size = Puppet.getBoundingBox().size.mul(breadthScale);
        Camera.setTargetSize(size.x, size.y, true);
        Camera.track(Puppet.position);
    }
    updateAmmoTick (delta = 0) {
        const { Animations } = this;
        const { ammo } = this.store;
        const blastAnimationsFinished = (!Animations.blasts || Animations.blasts.ended);
        // trigger blast animations
        for (const impact of ammo.impacts) {
            if (impact.triggered) continue;
            if (impact.time <= ammo.current.time) impact.play();
        }
        const prevBbox = ammo.current.getBoundingBox().clone();
        // update projectile
        ammo.current.update(delta / 1000);
        // are we done with projectile?
        const endProjectileEarly =
            (ammo.current.time >= SHOT_TRACE_LIMIT) // time out shots even if a landing exists
            || ((!ammo.map.finished || Animations.blasts.ended)
                // time out early if theres no landing and it flew offscreen
                //  or if all the blasts are done, and it flew offscreen
                && !ammo.current.isInsideDisplay);
        const isTimedout =
            !(ammo.map.finished && ammo.current.time >= ammo.map.time - Number.EPSILON)
            && endProjectileEarly;

        if (endProjectileEarly) {
            if (!blastAnimationsFinished) {
                // play any paused blast animations prematurely
                // shouldn't restart already playing animations
                Animations.blasts?.play?.();
            }
            if (this.Global.flags.DEBUG) {
                if (isTimedout) console.info(`[${typeString(this)}]: Shot timed out`);
                else console.info(`[${typeString(this)}]: Shot forcefully ended early`);
            }
            ammo.current = undefined;
        }
        // [!] boolean logic here could be written better -KT
        const playbackFinished = Animations.blasts?.ended
            || (!Animations.blasts && isTimedout);
        return playbackFinished;
    }
    drawMenuBackground () {
        const { cursor, size } = this.Global.Display;
        const { Viewbox } = this.Camera;
        const { MENU_BACKGROUND_TINT } = this.constructor;
        cursor.save();
        cursor.filter = "blur(10px)";
        Viewbox.setCursor(cursor, true);
        for (const { Puppet, isDead } of this.Players.values())
            if (!isDead) Puppet.draw(cursor);
        cursor.restore();
        this.drawBackground();
        Viewbox.setCursor(cursor, true);
        if (this.store.ammo.current && this.store.ammo.current.time > 0)
            this.store.ammo.current.draw(cursor);
        cursor.restore();
        cursor.fillStyle = MENU_BACKGROUND_TINT.toRGBA();
        cursor.rect(0, 0, size.x, size.y);
        cursor.fill();
        cursor.restore();
    }
    drawBackground () {
        const img = this.Threaded.cache[this.store.cacheKey.background].canvas;
        const { cursor, size } = this.Global.Display;
        const { Viewbox } = this.Camera;
        cursor.drawImage(img, Viewbox.min.x, cursor.normalizeY(Viewbox.max.y), Viewbox.width, Viewbox.height, 0, 0, size.x, size.y);
    }
    handleInput () {
        const { ClientPlayer, Interface, Global, flags, store } = this;
        const { keyboard, pointer } = Global.Input;
        if (INPUT_MAP.isActive(keyboard, "esc")) {
            // pause menu logic
        }
        if (!INPUT_MAP.isActive(keyboard, "debug+")) {
            if (INPUT_MAP.isActive(keyboard, "pan+")) {
                this.Camera.untrackAll();
                this.Camera.offsetPosition(PAN_SENSITIVITY);
                
            }
            if (INPUT_MAP.isActive(keyboard, "pan-")) {
                this.Camera.untrackAll();
                this.Camera.offsetPosition(-PAN_SENSITIVITY);
            }
        }
        if (INPUT_MAP.isActive(keyboard, "debug+")) {
            this.Menus.get("Ammo").open();
        }
        if (flags.isTurn) {
            // [!] most pointer logic handled by callbacks

            // keyboard
            if (!INPUT_MAP.isActive(keyboard, "debug+")) {
                if (store.ammo.current === undefined && store.ammo.selected) {
                    if (INPUT_MAP.isActive(keyboard, "shootActive"))
                        this.launchAmmo()
                            .catch((error) => {
                                console.error(`[${typeString(this)}]: Projectile trace error`);
                                throw error;
                            });
                }
                ClientPlayer.Puppet.position.round(1/Global.constructor.SETTINGS.RESOLUTION);
                if (INPUT_MAP.isActive(keyboard, "mv+")) {
                    ClientPlayer.Mover.move(MOVE_SPEED);
                    if (!pointer.isActive)
                        this.trackClientPlayer();
                }
                if (INPUT_MAP.isActive(keyboard, "mv-")) {
                    ClientPlayer.Mover.move(-MOVE_SPEED);
                    if (!pointer.isActive)
                        this.trackClientPlayer();
                }
                if (INPUT_MAP.isActive(keyboard, "shot+")) {
                    ClientPlayer.Aimer.power += POWER_SENSITIVITY;
                }
                if (INPUT_MAP.isActive(keyboard, "shot-")) {
                    ClientPlayer.Aimer.power -= POWER_SENSITIVITY;
                }
                if (INPUT_MAP.isActive(keyboard, "aim+")) {
                    ClientPlayer.Aimer.rotation += AIM_SENSITIVITY;
                }
                if (INPUT_MAP.isActive(keyboard, "aim-")) {
                    ClientPlayer.Aimer.rotation -= AIM_SENSITIVITY;
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
    updateTerrain (terrain, updatePlayers = true, changedBBoxes = []) {
        if (this.Terrain.hash !== terrain.hash)
            this.Terrain.apply(terrain);
        if (updatePlayers) {
            // if bboxes of changed areas are provided, only update player positions that lie within them.
            //  otherwise, update all player positions
            const players = changedBBoxes?.length
                ? this.Players.values().filter(({Puppet}) => {
                    const { position } = Puppet;
                    return changedBBoxes.some((bbox) => bbox.isIntersecting(position));
                }) : this.Players.values();
            for (const { Puppet, Mover } of players) {
                // update positioning - account for "falling"
                Puppet.position.round(2);
                Mover.apply(Mover.position.x, Mover.position.y);
            }
        }
    }
    createAmmo (playerActor, typeKey) {
        const { Camera, AmmoPool, Terrain } = this;
        const type = AmmoPool.get(typeKey);
        const ammo = new type(...playerActor.getLaunchParameters(Terrain));
        ammo.colliders.push(Terrain.polygon);
        ammo.launchCallback = this.#createLaunchCallback();
        ammo.displayBoundingBox = Camera.Viewbox;
        return ammo;
    }
    createPlayerColliders () {
        const colliders = [];
        const selfTeam = this.ClientPlayer.Metadata.team;
        for (const player of this.Players.values()) {
            if (player.isDead) continue;
            colliders.push(player.getCollider(player.id === this.#ClientPlayerID, player.Metadata.team === selfTeam));
        }
        return colliders;
    }
    animateTurn (turn) {
        this.setTurn(false);
        if (this.Terrain.hash !== turn.terrain(false).hash)
            this.updateTerrain(turn.terrain(true), false);
        for (const player of this.Players.values())
            turn.applyPlayerState(player);
        this.Threaded.cache[this.store.cacheKey.background] = turn.startFrame();
        this.loadTurn(turn.ammo(true), turn.intervals(true), turn.map());
    }
    loadTurn (ammo, intervals, map) {
        this.setTurn(false);
        if (intervals.length)
            this.#loadBlastIntervals(intervals);
        console.info(`[${typeString(this)}]: Playing shot animation`);
        this.#setAmmo(ammo, map);
        this.Camera.track(ammo.getBoundingBox(), this.ClientPlayer.Puppet.getBoundingBox());
    }
    setTurn (bool) {
        this.Camera.unlock();
        if (bool) {
            this.Camera.lerpFactor = 0.2;
            this.trackClientPlayer();
        } else {
            this.Camera.lerpFactor = 0.12;
        }
        this.flags.isTurn = this.ClientPlayer.Aimer.enabled = bool;
    }
    async launchAmmo () {
        const { ClientPlayer, AmmoPool, Global, store, flags } = this;
        this.setTurn(false);
        this.animate(true); // draw one last frame so the game doesn't look like it just froze
        Global.Events.raiseEvent("LOADING", {hide: false, message: "loading turn"});
        const ammo = this.createAmmo(ClientPlayer, store.ammo.selected);
        const totalStart = performance.now();
        let waitStart = performance.now();
        console.info(`[${typeString(this)}]: Tracing shot (${store.ammo.selected})`);
        const map = await this.Threaded.traceAmmo(
            ammo,
            Global.TickInterval.interval / 1000,
            SHOT_TRACE_LIMIT,
            this.store.cacheKey.terrain,
            this.createPlayerColliders()
        );
        if (Global.flags.DEBUG)
            console.info(`[${typeString(this)}]: Shot trace finished in ${(performance.now() - waitStart) / 1000} seconds`);
        waitStart = performance.now();
        console.info(`[${typeString(this)}]: Rendering shot collisions`);
        await this.#preloadTurn(ammo, map);
        if (Global.flags.DEBUG)
            console.info(`[${typeString(this)}]: Collision map computed in ${(performance.now() - waitStart) / 1000} seconds`);
        console.info(`[${typeString(this)}]: Shot playback ready`);
        if (performance.now() - totalStart > LOADING_PAUSE_THRESHOLD) {
            console.info(`[${typeString(this)}]: Awaiting click event`);
            Global.Events.raiseEvent("LOADING", {hide: false, message: "Waiting for click"});
            await Global.Input.pointer.onNextClick();
        }
        Global.Events.raiseEvent("LOADING", {hide: true});
        store.overlayItems.replayButton.hide = true;
        this.loadTurn(store.turn.ammo(true), store.turn.intervals(true), store.turn.map());
    }

    get AmmoPool () { return this.#AmmoPool }
    get Lobby () { return this.#Lobby }
    get ClientPlayer () { return this.Players.get(this.#ClientPlayerID) }
    get ActivePlayer () { return this.Players.get(this.Lobby.ActivePlayerID) }
    get Players () { return this.#Players }
    get Threaded () { return this.#Threaded }
    get Terrain () { return this.#Terrain }
    get Animations () { return this.#Animations }
}

class RoundTurn {
    #terrain;
    #ammo;
    #blastIntervals = new Array();
    #playerStates = {};
    #traceMap;
    #startFrame;
    #isClosed = false;
    constructor (intervals, players, terrain, ammo, backgroundFrame, traceMap) {
        this.#terrain = terrain;
        this.#ammo = ammo;
        this.#traceMap = traceMap;
        this.#startFrame = backgroundFrame;
        this.#blastIntervals = [...intervals];
        for (const player of players)
            this.#playerStates[player.id] = player.getState();
    }

    intervals (clone = true) {
        return clone
            ? this.#blastIntervals.map((interval) => interval.clone(true))
            : this.#blastIntervals;
    }
    terrain (clone = true) {
        return clone
            ? this.#terrain.clone(true)
            : this.#terrain;
    }
    ammo (clone = true) {
        return clone
            ? this.#ammo.clone(true)
            : this.#ammo;
    }
    map () {
        return this.#traceMap;
    }
    startFrame () {
        return this.#startFrame;
    }
    applyPlayerState (player) {
        if (!(player?.isActor && player.id in this.#playerStates)) return false;
        player.setState(this.#playerStates[player.id]);
        return true;
    }

    // [!] TODO: figure out how to clone these, or verify GC can tidy up runaway/old offscreenCanvases
    // close () {
    //     if (this.isClosed) return;
    //     this.#startFrame?.cursor?.close?.();
    //     this.#blastIntervals.forEach(({frame}) => frame?.cursor?.close?.());
    // }

    get isRoundTurn () { return true }
    get isClosed () { return this.#isClosed }
}

function createMuzzleFlashAnimation (playerActor, spritesheet, width) {
    spritesheet.width = width;
    spritesheet.rotation = playerActor.Aimer.rotation + Math.PI;
    const animation = new Animation(
        playerActor.Puppet.barrelPosition,
        spritesheet,
        spritesheet.framerate
    );
    animation.speed = 2.3;
    return animation;
}

function createBlastAnimation (blast) {
    const animation = new ShapeAnimation(
        blast.shape.clone(),
        .6,
        25,
        drawBlastAnimation,
        [new Color(255, 255, 255, 1), 2]
    );
    animation.speed = 1.25;
    return animation;
}

function createPlayerDeathAnimation (playerActor, spritesheet) {
    const { Puppet } = playerActor;
    spritesheet.rotation = Puppet.rotation.body;
    return new Animation(
        Puppet.relativePosition,
        spritesheet,
        spritesheet.framerate
    );
}

// [!] recursion limit applies per-player
function distributePlayers (bbox, players, recursionLimit = 10000) {
    const min = bbox.min.x + (bbox.width / 10);
    const max = bbox.max.x - min;
    const spacing = (bbox.width / players.length);
    const range = (max - min) / spacing; 
    const spots = new Set();
    for (const { Aimer, Mover } of players) {
        let x;
        let added = false;
        let i = 0;
        while (i < recursionLimit) {
            x = (Math.floor(Math.random() * (range + 1)) * spacing) + min;
            if (!spots.has(x) && Mover.apply(x, bbox.max.y + 1)) {
                spots.add(x);
                added = true;
                break;
            }
            i++;
        }
        if (!added && i >= recursionLimit) throw new Error("Recusion limit reached while distributing players. Is terrain invalid?");
        Aimer.update(players[0].Puppet.position.add({x: 0, y: bbox.max.y})); // aim straight up and set power to 100% (1)
    }
}

# ricelife-game
A multiplayer game running in a Discord Embedded App Activity

## Browser Demo
This demo is only available during inital testing. Support for running this application in a browser outside of a Discord Embedded Activity (the target client) is not guarenteed and will be discontinued at developer discretion.

#### Running the demo

The demo is available on Github Pages at: https://scritty1249.github.io/ricelife-game/ricelife-game/client
- *currently running off of the [beta-features](https://github.com/scritty1249/ricelife-game/tree/beta-worker-pool) branch*

> Running the demo yourself:\
> Use any server hosting method of choice, and serve `index.html` from the `/ricelife-game/client` directory scope. This demo (*and expected final version*) does not require any extra third-party binaries or modules to function beyond serving the game content.
>
> *Discord App SDK will be used in later stages of development to interact with the Discord application outside of gameplay.*

#### Controls
- **W,A,S,D:** Forward, Left, Backward, Right
- **Space:** Shoot currently selected ammo type
- **1-9,0:** Shoot ammo type 1-10
- **Arrow Up:** Increase shot power
- **Arrow Down:** Decrease shot power
- **Arrow Left:** Aim Left
- **Arrow Right:** Aim Right

> Mouse and Touch support:\
> *Dragging from anywhere inside of the aiming circle around the player's character will also set the aim and shot power*

#### Debugging support
The follow URL query parameters will have visible impact on the demo.
- `debug = true`**:** Will enable the debugger overlay, showing extra information about raycasters and collision boxes.
    - This can also be done by setting `debugTools = true` on the window object (*global console scope*). This value takes precedence over the `debug` URL parameter.
- `map = flat`**:** Will load flat terrain.
    - Setting this parameter to anything else or omitting it will cause the terrain generation to default to the normal, randomized, curvy terrain.

## Known Bugs
- Players may be able to phase through vertical terrain (*"walls"*) if the terrain is thin enough

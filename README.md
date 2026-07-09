# ricelife-game
An asynchronous turn-based PvP game running as a Discord Embedded App Activity.

## Project Description (Goal)
ricelife-game (name pending review) is a turn based game that can be played in Discord by sending messages when each player ends their turn. Each player drives, aims, and fires at one another from various vehicles using an arsenal of different ammunition types. A round ends when one team is completely eliminated, where all players are able to pick from a random set of modifiers to take into the next round- these can change how their vehicles, ammunition, and environment operate. Round limit pending review.

After enough development, automated Discord-based responses (emotes, memes, messages) to round actions and game outcomes may be implemented.

### Examples of Modifiers
- Player ammo bounces: +1 to limit (stackable)
- Player health increase: +? to limit (stackable)
- Player regenerates up to ? shield at the start of their turn: +? to regenerated amount (stackable)
- Player deals extra damage, but takes extra damage
- Player fires additional ammo, but ammo deals less damage: +1 additional ammo fired, -?% ammo damage (stackable)
- Player gain teleport action, can teleport once per round to a random location
- Player explodes on death, dealing a damage to any players nearby
- Player revives once per opponent on the enemy team upon death, at ?% reduced maximum health for every revive
- Player can revive teammates instead of firing on their turn
- ...

## Browser Demo
This demo is only available during inital testing. Support for running this application in a browser outside of a Discord Embedded Activity (the target client) is not guarenteed and will be discontinued at developer discretion.

#### Running the demo

The demo is available on Github Pages at: https://scritty1249.github.io/ricelife-game/ricelife-game/client

> Running the demo yourself:\
> Use any server hosting method of choice, and serve `index.html` from the `/ricelife-game/client` directory scope. This demo (*and expected final version*) does not require any extra third-party binaries or modules to function beyond serving the game content.
>
> *Discord App SDK will be used in later stages of development to interact with the Discord application outside of gameplay.*

#### Controls
- **W,A,S,D:** Forward, Left, Backward, Right
- **Space:** Shoot currently selected ammo type
- **Arrow Up:** Increase shot power
- **Arrow Down:** Decrease shot power
- **Arrow Left:** Aim Left
- **Arrow Right:** Aim Right

> Mouse and Touch support:\
> *Dragging from anywhere inside of the aiming circle around the player's character will also set the aim and shot power*

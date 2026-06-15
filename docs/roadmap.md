# Roadmap

- ~~Implement support for projectile explosion animations~~
    - ~~Explosion animations may be imported to client as a gif, coded on canvas directly, or simulated (not ideal for performance)~~ **Animations are imported as spritesheets**
- Create features to support / implement animations as described in gameplay loop
    - ~~Limited animations are implemented, but lack support for projectile blast VFX and SFX~~
    - ~~SFX support needed~~
- ~~Implement image assets and animations for projectiles~~ **Projectile visuals are implemented using basic geometry and rendering effects**
- Implement UI support
    - ~~Buttons, clicking buttons (functionality implemented in PointerListener)~~
    - Menus (pause, dropdowns, expandable, etc.)
    - *we will not be supporting right click for any actions* (for simplicity, subject to change)
- ~~Overhaul individual web workers for a worker pool and manager~~
    - ~~Create workers based on client device's supported thread count, instead of one per type of task~~
    - ~~Offload more animations to web workers~~
- ~~Implement turns as described in gameplay loop~~
- Create better/finalized assets for game
- ~~Add more shot types and behaviors~~
- Add at least 1 other tank type, with a "gimmick"
- Setup backend
    - Determine provider/api host
    - Determine database provider/host
        - Determine database structure
    - Implement API calls in client
    - Implement Server to Discord API messages
...

# Roadmap

- Implement support for projectile explosion animations
    - Explosion animations may be imported to client as a gif, coded on canvas directly, or simulated (not ideal for performance)
- Create features to support / implement animations as described in gameplay loop
    - Limited animations are implemented, but lack support for projectile blast VFX and SFX
- Implement UI support
    - Buttons, clicking buttons (functionality implemented in PointerListener)
    - Menus (pause, dropdowns, expandable, etc.)
    - *we will not be supporting right click for any actions* (for simplicity, subject to change)
- Implement turns as described in gameplay loop
- Setup backend
    - Determine provider/api host
    - Determine database provider/host
        - Determine database structure
    - Implement API calls in client
    - Implement Server to Discord API messages
...

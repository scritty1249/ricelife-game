# Gameplay loop
Gameplay will be divided into turns.

### Turn Events:
- Player can move tank
- Player can choose projectile type
- Player can aim
- Player can end their turn, preventing all further actions

### After turn:
- Compute animation frames (minor delay as this occurs is acceptable)
    - Animation is rendered client-side
    - Send turn data to server before playing animation, to catch errors
- Play animation for client
- Backend sends "Play now" message in current Discord channel for other player to continue game loop

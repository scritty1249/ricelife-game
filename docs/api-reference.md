# API Reference

## Base URL
The base path for all API requests is

`/api`

## Endpoints

### `GET /maps/manifest`
**Returns (JSON):**

A list of all available maps
| Key | Type |
| :-- | :-- |
| maps | array of [MapSelection](#object-mapselection) |

### `POST /lobby/new`
**Request Body Parameters (JSON):**

Game wil not start until `teamcount` is met.
| Key | Type | Detail |
| :-- | :-- | :-- |
| userid | [Snowflake](#string-snowflake) | from the initiating player |
| mapid | [Snowflake](#string-snowflake) ||
| channelid | [Snowflake](#string-snowflake) | Discord channel the invite was sent to |
| teamsize | integer | greater than `0` |
| teamcount | integer | greater than `1` |

**Returns (JSON):**

An ID of the created lobby, or null if one could not be made.
| Key | Type |
| :-- | :-- |
| lobbyid | ?[Snowflake](#string-snowflake) |

### `POST /lobby/add`
Add a player to a waiting lobby.

**Request Body Parameters (JSON):**
| Key | Type |
| :-- | :-- |
| lobbyid | [Snowflake](#string-snowflake) |
| userid | [Snowflake](#string-snowflake) |
| teamid | [Snowflake](#string-snowflake) |

**Returns (JSON):**

true if the lobby was joined, and false otherwise.
| Key | Type |
| :-- | :-- |
| success | boolean |

### `GET /lobby/info`
Get details of an ongoing lobby.

**Request Query Parameters:**
- `lobbyid` is the [Snowflake](#string-snowflake) ID of a waiting or active lobby

**Returns (JSON):**

The specified lobby's data, or null it does not exist.
| Key | Type |
| :-- | :-- |
| lobby | ?[Lobby](#object-lobby) |

### `POST /lobby/round/update`
Saves the state of an ongoing round.

**Request Body Parameters (JSON):**
| Key | Type | Detail |
| :-- | :-- | :-- |
| ... | ... | ... |

## Type Definitions

### *object* `PlayerInstance`
| Key | Type | Detail |
| :-- | :-- | :-- |
| position | [Vector](#array-vector) | player's current position |
| hitpoints | array of [HitAmount](#object-hitamount) | damage applied in descending order |
| data | [PlayerData](#object-playerdata) ||


### *object* `Lobby`
| Key | Type | Detail |
| :-- | :-- | :-- |
| terrain | [URL](#string-url) | link to download the terrain data |
| players | array of [PlayerInstance](#object-playerinstance) ||

### *object* `PlayerData`
| Key | Type | Detail |
| :-- | :-- | :-- |
| model | string | visual model type |
| ammo | array of [AmmoType](#string-ammotype) ||
| team | [Snowflake](#string-snowflake) | player's affiliation |
| profile | [PlayerProfile](#object-playerprofile) ||

### *object* `PlayerProfile`
| Key | Type | Detail |
| :-- | :-- | :-- |
| userid | [Snowflake](#string-snowflake) ||
| name | string | display name within the Discord channel |
| avatar | [URL](#string-url) | link to the avatar within the Discord channel |
| ?fontFamily | string | font to render `name` with in-game |

### *object* `MapSelection`
| Key | Type | Detail |
| :-- | :-- | :-- |
| name | string ||
| src | [URL](#URL) | location of terrain data |
| thumb | [URL](#URL) | location of thumbnail image |

### *object* `HitAmount`
| Key | Type | Detail |
| :-- | :-- | :-- |
| type | string | hitpoint type |
| max | integer ||
| amount | integer | current hitpoints |
| regen | number ||
| reserve | number | `amount` cannot exceed this |
| increase | number | factor all increases to `amount` are applied by |
| decrease | number | factor all decreases to `amount` are applied by |

### *array* `Vector`
| Index | Type | Detail |
| :-- | :-- | :-- |
| 0 | number | x |
| 1 | number | y |

### *string* `URL`
A link to a specified location or resource.

### *string* `AmmoType`
The unique name of an in-game Ammo type.

### *string* `Snowflake`
A unique 64 bit identifier. See [Discord's documentation](https://docs.discord.com/developers/reference#snowflakes) for more information on Snowflake IDs.
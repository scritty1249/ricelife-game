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

### `GET /lobby/terrain`

**Request Query Parameters**
- `lobbyid` is the [Snowflake](#string-snowflake) ID of a waiting or active lobby
- `userid` is the [Snowflake](#string-snowflake) ID of the calling player.

**Returns (JSON):**

The signed endpoint to download the lobby's terrain data.

| Key | Type | Detail |
| :-- | :-- | :-- |
| url | [URL](#string-url) | a link to download a lobby's terrian data |
| ttl | number | seconds before the link expires |


- If a corrosponding lobby to `lobbyid` cannot be found, this endpoint will return `404 Not Found`
- If the player indicated by `playerid` is not in the corrosponding lobby, this endpoint will return `403 Forbidden`

### `POST /lobby/round/update`
Saves the state of an ongoing round. Updated players corrospond to players that are already in the lobby. Updates to players that do not already in the lobby are discarded.

**Request Body Parameters (Multipart/FormData):**
| Key | Type | Detail |
| :-- | :-- | :-- |
| players | array of [PlayerInstance](#object-playerinstance) |  player instances in the lobby, if any have changed |
| ?terrain | [Polygon](#object-polygon) | terrain data, if terrain state has changed |

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

### *binary stream* `Polygon`
Should be sent as a blob of `application/octet-stream` type.
| Byte | Type | Detail |
| :-- | :-- | :-- |
| 0-4 | uint32 | length `X` of following [PolygonMetadata](#object-polygonmetadata) |
| 4 to `X` | [PolygonMetadata](#object-polygonmetadata) ||
| `X` ( *`i`<sub>0</sub>* ) to `Y`<sub>0</sub> | [Path](#array-path) | polygon path |
| `i`<sub>`n`</sub> to `Y`<sub>`n`</sub> | [Path](#array-path) | `n` hole paths, if any. Depth-first order is recommended but not required |

### *object* `PolygonMetadata`
| Key | Type | Detail |
| :-- | :-- | :-- |
| i | uint32 | *index*. Starting byte index of pathlength |
| p | number | *pathlength*. Length `Y` of [Path](#array-path) for corrosponding [Polygon](#object-polygon) |
| h | array of [PolygonMetadata](#object-polygonmetadata) | *holes*. For sanity, backend will impose a recursion depth limit of 3 |

### *array* `Vector`
| Index | Type | Detail |
| :-- | :-- | :-- |
| 0 | number | x |
| 1 | number | y |

### *array* `Path`
Contains the buffer of a `Float32Array` representing [Vectors](#array-vector). Should be sent as part of a blob.

### *string* `URL`
A link to a specified location or resource.

### *string* `AmmoType`
The unique name of an in-game Ammo type.

### *string* `Snowflake`
A unique 64 bit identifier. See [Discord's documentation](https://docs.discord.com/developers/reference#snowflakes) for more information on Snowflake IDs.
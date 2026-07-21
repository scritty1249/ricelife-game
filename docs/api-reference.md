# API Reference

## Base URL
The base URL for all API requests is

`/api`

## Endpoints

### `GET /maps/manifest`

**Returns:**

Returns a manifest of all available maps
| Key | Type |
| :-- | :-- |
| maps | array of [MapSelection](#object-mapselection) |



## Type Definitions

### *object* `MapSelection`
| Key | Value Type | Extra Detail |
| :-- | :-- | :-- |
| name | [URL](#URL) ||
| src | string | where the terrain data is stored |
| thumb | [URL](#URL) | where the thumbnail image is stored |

### *string* `URL`
A link to a specified resource or endpoint.
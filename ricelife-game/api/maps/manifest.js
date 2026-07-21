const DEV_PROD = process.env.NODE_ENV === "development";

export async function GET (request) {
  try {
    const manifest = DEV_PROD
        ? await getDevManifest()
        : await getManifest();
    return Response.json({maps: manifest || []});
  } catch (error) {
    console.error(error);
    return Response.json({error: error.message}, {status: 500, statusText: "Internal server error"});
  }
}

async function getManifest () {
    const endpoint = process.env.EDGE_CONFIG;
    const response = await fetch(`${endpoint}/items/map_manifest`);
    if (!response.ok) return null;
    return await response.json();
}

async function getDevManifest () {
    if (!DEV_PROD) return null;
    const store = JSON.parse(process.env.EDGE_CONFIG);
    const { map_manifest } = store;
    return map_manifest;
}
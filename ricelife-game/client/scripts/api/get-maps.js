export async function getMapLegend () {
    const endpoint = window.location.origin + "/api/maps/manifest";
    const response = await fetch(endpoint);
    return response.ok
        ? await response.json()
        : {};
}
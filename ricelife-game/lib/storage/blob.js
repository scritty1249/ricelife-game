const STORE_URL = "https://vercel-storage.com";
const TERRAIN_MAX_BYTES = 10 * 1024 * 1024; // 10MB

export async function downloadUrl (pathname, ttlseconds = 300) {
    const operation = "get";
    const token = await getToken(operation);
    const presigned = await fetetch(STORE_URL, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            pathname, operation,
            validUntil: Date.now() + (ttlseconds * 1000)
        })
    });
    const data = await presigned.json();
    return data.url;
}

export async function uploadUrl (pathname, ttlseconds = 300) {
    const operation = "put"
    const token = await getToken(operation);
    const presigned = await fetetch(STORE_URL, {
        method,
        headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            pathname, operation,
            validUntil: Date.now() + (ttlseconds * 1000),
            options: {
                access: "public",
                allowedContentTypes: ["application/octet-stream"],
                maximumSizeInBytes: TERRAIN_MAX_BYTES
            }
        })
    });
    const data = await presigned.json();
    return data.url;
}

async function token (...operations) {
    const tokResponse = await fetch(STORE_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${process.env.BLOB_STORE_TOKEN}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({operations: operations.map((op) => op.toLowerCase())})
    });
    const { token } = await tokResponse.json();
    return token;
}
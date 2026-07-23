export function unpackPolygon (buffer) {
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);

    const metadataSizeOffset = 4; // 32-bit uint
    const metadataSize = view.getUint32(0, true);
    const headerOffset = metadataSizeOffset + metadataSize; 

    const metadataBytes = uint8View.subarray(metadataSizeOffset, headerOffset);
    const metadataText = new TextDecoder().decode(metadataBytes);
    const metadata = JSON.parse(metadataText);
    return decodePolygon(metadata, view, headerOffset);
}

export async function stream (url) {
    const response = await fetch(url);
    if (!response.ok) throw new Error();
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
        chunks.push(chunk); // Uint8Array view
        length += chunk.length;
    }

    const buffer = new ArrayBuffer(length);
    const view = new Uint8Array(buffer);

    let offset = 0;
    for (const chunk of chunks) {
        view.set(chunk, offset);
        offset += chunk.length;
    }
    return buffer;
}

function decodePolygon (metadata, view, headerOffset) {
    const bytes = Float32Array.BYTES_PER_ELEMENT; // 4 bytes
    const elements = (metadata.p || 0) / bytes;
    const path = new Float32Array(elements);
    const byteStart = headerOffset + (metadata.o || 0);
    for (let i = 0; i < elements; i++) {
        path[i] = view.getFloat32(byteStart + (i * bytes), true);
    }
    const holes = (metadata.h || [])
        .map((meta) => decodePolygon(meta, view, headerOffset));
    return { path, holes };
}

export function packPolygon (polygon) {
    const { metadata, path } = encodePolygon(polygon, 0);
    const metadataSizeOffset = 4; // 32-bit uint

    const metadataBytes = new TextEncoder().encode(JSON.stringify(metadata));
    const metadataSize = metadataBytes.length;
    const headerOffset = metadataSizeOffset + metadataSize;
    const totalBytes = headerOffset + path.byteLength;

    const buffer = new ArrayBuffer(totalBytes);
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);
    const float32View = new Float32Array(buffer, headerOffset);

    view.setUint32(0, metadataSize, true); // in Little Endian
    uint8View.set(metadataBytes, metadataSizeOffset);
    float32View.set(path);

    return buffer;
}

function encodePolygon (polygon, offset) {
    const path = polygon.path.Float32();
    const metadata = {
        o: offset || 0,
        p: path.byteLength,
        h: []
    }
    let length = metadata.p;
    const paths = [path];
    for (const hole of polygon.holes) {
        const o = metadata.o + length;
        const { path: p, metadata: m } = encodePolygon(hole, o);
        metadata.h.push(m);
        paths.push(p);
        length += m.p;
    }
    return {
        metadata,
        path: mergeFloat32Arrays(paths)
    };
}

function mergeFloat32Arrays (arrays) {
    const length = arrays.reduce((acc, curr) => acc + curr.length, 0);
    const result = new Float32Array(length);
    let offset = 0;
    for (const array of arrays) {
        result.set(array, offset);
        offset += array.length;
    }
    return result;
}

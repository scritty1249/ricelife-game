
export function unpackPolygon (buffer) {
    const view = new DataView(buffer);
    const uint8View = new Uint8Array(buffer);

    const metadataSizeOffset = 4; // 32-bit uint
    const metadataSize = view.getUint32(0, true);
    const headerOffset = Math.ceil((metadataSizeOffset + metadataSize) / 4) * 4; // 32-bit float

    const metadataBytes = uint8View.subarray(metadataSizeOffset, metadataSizeOffset + metadataSize);
    const metadataText = new TextDecoder().decode(metadataBytes);
    const metadata = JSON.parse(metadataText);

    const float32View = new Float32Array(buffer, headerOffset);
    return decodePolygon(metadata, float32View);
}

function decodePolygon (metadata, view) {
    const bytes = view.constructor.BYTES_PER_ELEMENT;
    const index = (metadata.o || 0) / bytes;
    const length = (metadata.p || 0) / bytes;
    const path = view.subarray(index, index + length);
    const holes = (metadata.h || [])
        .map((meta) => decodePolygon(meta, view));
    return { path, holes };
}
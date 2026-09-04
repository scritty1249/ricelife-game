export class BlobPacker {
    static HEADER_SIZE_OFFSET = 4; // 32-bit uint
    static *unpack (buffer, byteOffset = 0) {
        const { HEADER_SIZE_OFFSET } = BlobPacker;
        const size = buffer.byteLength;
        const view = new DataView(buffer, byteOffset || 0);
        let offset = 0;
        while (offset < size) {
            const length = view.getUint32(offset, true);
            offset += HEADER_SIZE_OFFSET;
            const data = new DataView(buffer, offset + view.byteOffset, length);
            offset += length;
            yield data;
        }
    }
    // close buffer if browser supports it
    static closeBuffer (buffer) {
        if (typeof buffer?.transfer === "function")
            buffer.transfer();
    }
    #textEncoder = new TextEncoder();
    #items = new Array();
    constructor () {}

    // data may be an ArrayBuffer or JSON Object
    push (data) {
        this.#items.push(data);
    }
    at (index) {
        return this.#items.at(index);
    }
    pack () {
        const { HEADER_SIZE_OFFSET, closeBuffer } = BlobPacker;
        const { buffers, length: totalItems} = this;
        const size = buffers.reduce((acc, curr) => acc + curr.byteLength + HEADER_SIZE_OFFSET, 0);
        const uintView = new Uint8Array(size);
        const dataView = new DataView(uintView.buffer);
        let offset = 0;
        for (let i = 0; i < buffers.length && offset < size; i++) {
            const buffer = buffers[i];
            const length = buffer.byteLength;
            dataView.setUint32(offset, length, true);
            offset += HEADER_SIZE_OFFSET;
            uintView.set(new Uint8Array(buffer), offset);
            offset += length;
            closeBuffer(buffer);
        }
        return uintView.buffer;
    }

    get isBlobPacker () { return true }
    get length () { return this.#items.length }
    // returns buffer clones
    get buffers () {
        const buffers = [];
        for (const item of this.#items) {
            if (item instanceof ArrayBuffer) {
                buffers.push(item.slice(0));
            } else if (ArrayBuffer.isView(item) && item?.buffer instanceof ArrayBuffer) {
                buffers.push(item.buffer.slice(item.byteOffset, item.byteOffset + item.byteLength));
            } else if (item) {
                const buffer = this.#textEncoder.encode(JSON.stringify(item));
                buffers.push(buffer);
            } else {
                buffers.push(new ArrayBuffer(0, {maxByteLength: 0}));
            }
        }
        return buffers;
    }
}

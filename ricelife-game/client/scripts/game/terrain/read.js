// read terrain data as csv stream
import { Vector, Path, BoundingBox } from "../geometry/geometry.js";

// format should be: length, PlaneSizeX, PlaneSizeY, x, y, x1, y1, ...

async function* readTerrainStream (stream) {
    const reader = stream.getReader();
    let num = 0;
    let negative = false;
    let decimal = 0;
    let isNum = false;
    const output = () => negative ? -num : num;
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        for (let i = 0; i < value.length; i++) {
            const byte = value[i];
            if (byte === 45) { // negative sign
                negative = isNum = true;
            } else if (byte >= 48 && byte <= 57) { // 0 - 9
                const digit = byte - 48;
                isNum = true;
                if (decimal === 0) {
                    num = (num * 10) + digit;
                } else {
                    num = num + (digit * Math.pow(10, -decimal));
                    decimal++;
                }
            } else if (byte === 46) { // decimal point
                decimal = 1;
            } else if (isNum
                && (/*byte === 44 || */byte === 10 || byte === 13) // comma(not expected), newline, carriage return
            ) { 
                yield output();
                num = 0;
                negative = false;
                decimal = 0;
                isNum = false;
            }
        }
    }
    if (isNum) yield output();
}

async function readTerrainData (asyncStreamGenerator) {
    let data;
    let i = 0;
    for await (const number of asyncStreamGenerator) {
        if (!data) {
            data = new Float32Array(number);
        } else {
            data[i] = number;
            i++;
        }
    }
    return data;
}

export async function readTerrain (src) {
    const response = await fetch(src);
    const stream = readTerrainStream(response.body);
    const array = await readTerrainData(stream);
    const iterator = array.values();
    return iterator;
}

import * as BLOB from "./storage/blob.js";
import * as KV from "./storage/kv.js";

export function printError (error) {
    console.error(JSON.stringify({
        message: error.message,
        name: error.name,
        stack: error.stack
            ? error.stack
                .split("\n")
                .map(line => line.trim())
            : []
    }));
}
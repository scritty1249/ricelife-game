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

export async function promiseTimeout (timeoutMs) {
    return await new Promise((resolve) => setTimeout(resolve, timeoutMs));
}

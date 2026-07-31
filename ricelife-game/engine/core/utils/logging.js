export function typeString (obj) { return obj?.constructor?.name || obj?.name || typeof obj }

export function objectString (obj) { try { return JSON.stringify(obj) } catch { return new String(object) } }
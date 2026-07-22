import { crypto } from "node:crypto";

export async function generateToken () {
    return crypto.randomBytes(32).toString("base64url");
}
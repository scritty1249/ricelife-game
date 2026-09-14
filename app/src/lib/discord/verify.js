import { default as nacl } from "tweetnacl";

export function verify (headers, bodyStr) {
    const sig = headers?.get("X-Signature-Ed25519");
    const stamp = headers?.get("X-Signature-Timestamp");

    return nacl.sign.detached.verify(
        Buffer.from(stamp + bodyStr),
        Buffer.from(sig, "hex"),
        Buffer.from(process.env.DISCORD_PUBLIC_KEY, "hex")
    );
}

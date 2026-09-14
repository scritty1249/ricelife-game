export const BIT32_SPACE = 4294967296;
export class FNV1a {
    static BASE = 0x811c9dc5;
    static PRIME = 0x01000193;
    // returning hash integers
    static Hash32Bit (number) {
        return FNV1a.toNumber32Bit(FNV1a.Base32Bit(number));
    }
    static HashJoin32Bit (numbers) {
        if (!numbers?.length) return undefined;
        let hash = FNV1a.Base32Bit(numbers[0]);
        for (let i = 1; i < numbers.length; i++)
            hash = FNV1a.Extend32Bit(hash, numbers[i]);
        return FNV1a.toNumber32Bit(hash);
    }
    // building hash functions
    static Base32Bit (number) {
        return FNV1a.Extend32Bit(FNV1a.BASE, number);
    }
    static Extend32Bit (hash, value) { // value may be a number or hash
        const prime = FNV1a.PRIME;
        hash ^= value & 0xff;
        hash = Math.imul(hash, prime);
        hash ^= (value >> 8) & 0xff;
        hash = Math.imul(hash, prime);
        hash ^= (value >> 16) & 0xff;
        hash = Math.imul(hash, prime);
        hash ^= (value >> 24) & 0xff;
        hash = Math.imul(hash, prime);
        return hash;
    }
    static toNumber32Bit (hash) {
        return hash >>> 0;
    }
}
Object.freeze(FNV1a);

// just need uniqueness and speed from hashing, not worrying as much about collision
export class Hashable {
    // unsigned 32-bit Integer
    static hash (hashables) {
        return FNV1a.toNumber32Bit(Hashable.rawHash(hashables));
    }
    // used for multi-step hashing operations
    static rawHash (hashables) {
        if (!hashables?.length) return undefined;
        let hash = hashables[0].rawHash;
        for (let i = 1; i < hashables.length; i++)
            hash = FNV1a.Extend32Bit(hash, hashables[i].rawHash);
        return hash;
    }
    get isHashable () { return true }
    // unsigned 32-bit Integer
    get hash () { return FNV1a.toNumber32Bit(this.rawHash) }
    // used for multi-step hashing operations
    get rawHash () { return undefined }
}

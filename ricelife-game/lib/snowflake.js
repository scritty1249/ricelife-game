export class Snowflake {
    constructor (node, epoch = 1000212400000n) {
        if (node < 0n || node > 1023n) throw new Error(`Node ID must be between 0 and 1023`);
        this.node = BigInt(node);
        this.epoch = BigInt(epoch);
        
        this.sequenceBits = 12n;
        this.nodeBits = 10n;
        
        this.nodeShift = this.sequenceBits;
        this.timestampLeftShift = this.sequenceBits + this.nodeBits;
        this.sequenceMask = -1n ^ (-1n << this.sequenceBits); // 4095
        
        this.lastTimestamp = -1n;
        this.sequence = 0n;
    }

    generate () {
        let timestamp = BigInt(Date.now());
        if (timestamp < this.lastTimestamp)
            throw new Error(`[${this.constructor.name}]: Failed to generate ID, clock moved backwards`);
        if (this.lastTimestamp === timestamp) {
            this.sequence = (this.sequence + 1n) & this.sequenceMask;
            if (this.sequence === 0n)
                while (timestamp <= this.lastTimestamp)
                    timestamp = BigInt(Date.now());
        } else {
            this.sequence = 0n;
        }
        this.lastTimestamp = timestamp;
        const snowflakeid = ((timestamp - this.epoch) << this.timestampLeftShift)
        | (this.node << this.nodeShift)
        | this.sequence;
        return snowflakeid.toString();
    }
}

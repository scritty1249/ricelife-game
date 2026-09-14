import { Health } from "./Health.js";
import { Shield } from "./Shield.js";
export const HitpointMap = {
    [Health.TYPE]: Health,
    [Shield.TYPE]: Shield
};
export { Health, Shield }
Object.freeze(HitpointMap);

import Scatter from "./Scatter.js";

export default class MegaScatter extends Scatter {
    static NAME = "MegaScatter";
    static IMPORT = process.env.SELF_OUTPUT_NAME;
    static beamCount = 5;
}
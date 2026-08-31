import Scatter from "./Scatter.js";

export default class GigaScatter extends Scatter {
    static NAME = "GigaScatter";
    static IMPORT = "GigaScatter" + process.env.SELF_HASH; 
    static beamCount = 12;
}
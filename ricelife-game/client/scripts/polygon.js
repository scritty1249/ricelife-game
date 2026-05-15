export class Polygon {
    constructor (...points) {
        this.points = points;
    }

    smooth (resolution = 1) {
        const newPoints = [];
        for (let i = 0; i < this.points.length; i++) {
            const current = this.points[i];
            newPoints.push(current);
            if (i + 1 > this.points.length) continue;
            const next = this.points[i + 1];
            const diff = current.abs().sub(next.abs())
            if (diff.x > resolution) {
                for (let inc = 0; inc < diff.x; inc += resolution) {
                    // [!] TODO: finish logic for smoothing
                }
            }
            if (diff.y > resolution) {

            }
        }
    }
}
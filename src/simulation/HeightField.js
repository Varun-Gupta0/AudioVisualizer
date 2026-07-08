/**
 * HeightField — scalar 2D height map over the petri dish area.
 * This is the single source of truth for all spike heights.
 * No rendering logic. No audio logic. Pure data.
 */
export default class HeightField {
    /**
     * @param {number} gridW  - Cell columns
     * @param {number} gridH  - Cell rows
     * @param {number} worldRadius - World-space radius of the petri dish
     */
    constructor(gridW = 80, gridH = 80, worldRadius = 1.85) {
        this.gridW = gridW;
        this.gridH = gridH;
        this.worldRadius = worldRadius;

        // Primary data buffer — all values clamped 0 → N
        this.data = new Float32Array(gridW * gridH);

        // Scratch buffer used by Diffusion to avoid in-place aliasing
        this.scratch = new Float32Array(gridW * gridH);
    }

    /** Zero every cell. Called at the start of each attractor write pass. */
    clear() {
        this.data.fill(0);
    }

    /**
     * Convert a world-space (x, z) coordinate to a grid cell index.
     * Returns -1 if the position is outside the grid.
     */
    worldToCell(wx, wz) {
        // Map [-worldRadius, worldRadius] → [0, gridW/H]
        const cx = Math.floor(((wx + this.worldRadius) / (2 * this.worldRadius)) * this.gridW);
        const cz = Math.floor(((wz + this.worldRadius) / (2 * this.worldRadius)) * this.gridH);
        if (cx < 0 || cx >= this.gridW || cz < 0 || cz >= this.gridH) return -1;
        return cz * this.gridW + cx;
    }

    /**
     * Bilinear interpolation sample at world-space (wx, wz).
     * Returns a smooth height value between 0 and N.
     */
    sample(wx, wz) {
        // Fractional grid coords
        const fx = ((wx + this.worldRadius) / (2 * this.worldRadius)) * this.gridW;
        const fz = ((wz + this.worldRadius) / (2 * this.worldRadius)) * this.gridH;

        const x0 = Math.floor(fx);
        const z0 = Math.floor(fz);
        const x1 = Math.min(x0 + 1, this.gridW - 1);
        const z1 = Math.min(z0 + 1, this.gridH - 1);
        const tx = fx - x0;
        const tz = fz - z0;

        const xCl0 = Math.max(0, Math.min(x0, this.gridW - 1));
        const xCl1 = Math.max(0, Math.min(x1, this.gridW - 1));
        const zCl0 = Math.max(0, Math.min(z0, this.gridH - 1));
        const zCl1 = Math.max(0, Math.min(z1, this.gridH - 1));

        const v00 = this.data[zCl0 * this.gridW + xCl0];
        const v10 = this.data[zCl0 * this.gridW + xCl1];
        const v01 = this.data[zCl1 * this.gridW + xCl0];
        const v11 = this.data[zCl1 * this.gridW + xCl1];

        return (v00 * (1 - tx) + v10 * tx) * (1 - tz) +
               (v01 * (1 - tx) + v11 * tx) * tz;
    }

    /**
     * Stamp a Gaussian energy bump centred at world (cx, cz).
     * @param {number} cx - World X of attractor centre
     * @param {number} cz - World Z of attractor centre
     * @param {number} amplitude - Peak energy (e.g. 0 → 3)
     * @param {number} radius - World-space influence radius
     */
    addGaussian(cx, cz, amplitude, radius) {
        if (amplitude <= 0.001) return;

        // Convert attractor centre to grid coords
        const gcx = ((cx + this.worldRadius) / (2 * this.worldRadius)) * this.gridW;
        const gcz = ((cz + this.worldRadius) / (2 * this.worldRadius)) * this.gridH;

        // Convert world radius to grid cells
        const rcells = (radius / (2 * this.worldRadius)) * this.gridW;
        const rcellsSq = rcells * rcells;

        const x0 = Math.max(0, Math.floor(gcx - rcells));
        const x1 = Math.min(this.gridW - 1, Math.ceil(gcx + rcells));
        const z0 = Math.max(0, Math.floor(gcz - rcells));
        const z1 = Math.min(this.gridH - 1, Math.ceil(gcz + rcells));

        for (let z = z0; z <= z1; z++) {
            for (let x = x0; x <= x1; x++) {
                const dx = x - gcx;
                const dz = z - gcz;
                const distSq = dx * dx + dz * dz;
                if (distSq <= rcellsSq) {
                    // Gaussian falloff: e^(-d²/2σ²)  where σ = rcells/2
                    const sigma = rcells / 2;
                    const weight = Math.exp(-distSq / (2 * sigma * sigma));
                    this.data[z * this.gridW + x] += amplitude * weight;
                }
            }
        }
    }
}

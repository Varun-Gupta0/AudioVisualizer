/**
 * Diffusion — Gaussian blur pass applied to a HeightField.
 * Spreads energy across neighbouring cells, creating organic surface tension.
 * Reads from field.data, writes through field.scratch to avoid aliasing.
 */
export default class Diffusion {
    /**
     * @param {object} opts
     * @param {number} [opts.passes=1]   - How many blur iterations per frame
     * @param {number} [opts.decay=0.92] - Per-frame energy decay (< 1 = dampening)
     */
    constructor({ passes = 1, decay = 0.92 } = {}) {
        this.passes = passes;
        this.decay = decay;

        // 3×3 Gaussian kernel (normalized)
        this.kernel = [
            0.0625, 0.125, 0.0625,
            0.125,  0.25,  0.125,
            0.0625, 0.125, 0.0625,
        ];
    }

    /**
     * Apply diffusion to the field in-place.
     * @param {import('./HeightField.js').default} field
     */
    apply(field) {
        const { gridW, gridH, data, scratch } = field;

        for (let pass = 0; pass < this.passes; pass++) {
            // Convolve data → scratch
            for (let z = 0; z < gridH; z++) {
                for (let x = 0; x < gridW; x++) {
                    let sum = 0;
                    let ki = 0;
                    for (let dz = -1; dz <= 1; dz++) {
                        for (let dx = -1; dx <= 1; dx++) {
                            const nx = Math.max(0, Math.min(x + dx, gridW - 1));
                            const nz = Math.max(0, Math.min(z + dz, gridH - 1));
                            sum += data[nz * gridW + nx] * this.kernel[ki];
                            ki++;
                        }
                    }
                    scratch[z * gridW + x] = sum;
                }
            }

            // Copy scratch back into data and apply decay
            for (let i = 0; i < data.length; i++) {
                data[i] = scratch[i] * this.decay;
            }
        }
    }
}

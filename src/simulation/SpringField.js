/**
 * SpringField — per-spike spring physics that reads targets from a HeightField.
 *
 * Springs never receive raw FFT values.
 * Springs only stabilize sampled field values.
 * No rendering logic here.
 */
export default class SpringField {
    /**
     * @param {THREE.Vector3[]} positions - World positions of all spikes (x, y, z)
     * @param {object} opts
     * @param {number} [opts.tension=80]
     * @param {number} [opts.damping=10]
     * @param {number} [opts.mass=3.0]
     * @param {number} [opts.restHeight=1.0]
     */
    constructor(positions, {
        tension = 80,
        damping = 10,
        mass = 3.0,
        restHeight = 1.0,
    } = {}) {
        this.count = positions.length;
        this.tension = tension;
        this.damping = damping;
        this.mass = mass;
        this.restHeight = restHeight;

        // Store x,z world coordinates for field sampling
        this.xs = new Float32Array(this.count);
        this.zs = new Float32Array(this.count);
        for (let i = 0; i < this.count; i++) {
            this.xs[i] = positions[i].x;
            this.zs[i] = positions[i].z;
        }

        // Physics state
        this.heights    = new Float32Array(this.count).fill(restHeight);
        this.velocities = new Float32Array(this.count).fill(0);
    }

    /**
     * Advance spring physics by dt seconds.
     * Reads targets from field via bilinear sample.
     *
     * @param {import('./HeightField.js').default} field
     * @param {number} dt - Frame delta (seconds, clamped to 50ms)
     */
    update(field, dt) {
        const safeDt = Math.min(dt, 0.05);
        const { tension, damping, mass, restHeight } = this;

        for (let i = 0; i < this.count; i++) {
            // Sample the continuous field at this spike's world position.
            // Field returns an energy value 0 → N; add restHeight so spikes
            // stand at 1.0 when the field is silent.
            const target = restHeight + field.sample(this.xs[i], this.zs[i]);

            const h = this.heights[i];
            let v    = this.velocities[i];

            // Hooke's Law: F = -k(x - target) - c(v)
            const force        = -tension * (h - target) - damping * v;
            const acceleration = force / mass;

            v += acceleration * safeDt;
            let newH = h + v * safeDt;

            if (newH < 0.05) { newH = 0.05; v = 0; }

            this.heights[i]    = newH;
            this.velocities[i] = v;
        }
    }

    /** Get the current animated height for spike index i. */
    getHeight(i) {
        return this.heights[i];
    }
}

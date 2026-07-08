/**
 * AttractorSystem — maps audio band energies to Gaussian bumps on the HeightField.
 *
 * Layout:
 *   Bass   → 1 center attractor
 *   Mid    → 6 ring attractors (hexagonal)
 *   Treble → 12 outer halo attractors
 *
 * Attractors never store state — they write fresh each frame after field.clear().
 */
export default class AttractorSystem {
    /**
     * @param {object} opts
     * @param {number} [opts.dishRadius=1.85]        - World radius of the petri dish
     * @param {number} [opts.bassStrength=3.0]       - Peak amplitude for bass attractor
     * @param {number} [opts.midStrength=2.0]
     * @param {number} [opts.trebleStrength=1.5]
     * @param {number} [opts.demoMode=true]          - Use sine waves instead of audio for testing
     */
    constructor({
        dishRadius = 1.85,
        bassStrength = 3.0,
        midStrength = 2.0,
        trebleStrength = 1.5,
        demoMode = true,
    } = {}) {
        this.dishRadius = dishRadius;
        this.bassStrength = bassStrength;
        this.midStrength = midStrength;
        this.trebleStrength = trebleStrength;
        this.demoMode = demoMode;
        this._t = 0; // internal timer for demo sine waves

        // Pre-build the attractor positions once
        this._attractors = this._buildAttractors();
    }

    _buildAttractors() {
        const R = this.dishRadius;
        const attractors = [];

        // 1 center attractor — bass
        attractors.push({ x: 0, z: 0, band: 'bass', radius: R * 0.55 });

        // 6 mid ring attractors at 0.55R
        for (let i = 0; i < 6; i++) {
            const angle = (i / 6) * Math.PI * 2;
            attractors.push({
                x: Math.cos(angle) * R * 0.5,
                z: Math.sin(angle) * R * 0.5,
                band: 'mid',
                radius: R * 0.35,
            });
        }

        // 12 outer treble attractors at 0.85R
        for (let i = 0; i < 12; i++) {
            const angle = (i / 12) * Math.PI * 2;
            attractors.push({
                x: Math.cos(angle) * R * 0.82,
                z: Math.sin(angle) * R * 0.82,
                band: 'treble',
                radius: R * 0.22,
            });
        }

        return attractors;
    }

    /**
     * Write attractor contributions to the field.
     * @param {import('./HeightField.js').default} field
     * @param {{ bass: number, mid: number, treble: number }} energy  - 0 → 1 values
     * @param {number} dt - Frame delta time (seconds)
     */
    update(field, energy, dt) {
        this._t += dt;

        // Demo mode: override energy with smooth sine waves so scene runs without mic
        let e = energy;
        if (this.demoMode) {
            e = {
                bass:   (Math.sin(this._t * 0.7)  * 0.5 + 0.5) * 0.8,
                mid:    (Math.sin(this._t * 1.3 + 1.0) * 0.5 + 0.5) * 0.6,
                treble: (Math.sin(this._t * 2.1 + 2.5) * 0.5 + 0.5) * 0.4,
            };
        }

        const strengthMap = {
            bass:   this.bassStrength,
            mid:    this.midStrength,
            treble: this.trebleStrength,
        };

        // Clear then stamp every attractor
        field.clear();
        for (const att of this._attractors) {
            const amplitude = e[att.band] * strengthMap[att.band];
            field.addGaussian(att.x, att.z, amplitude, att.radius);
        }
    }

    /** Switch to live audio mode (disable demo sine waves). */
    setLiveMode() { this.demoMode = false; }
    setDemoMode()  { this.demoMode = true; }
}

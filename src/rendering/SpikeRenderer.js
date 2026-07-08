import * as THREE from 'three';

/**
 * SpikeRenderer — pure InstancedMesh renderer.
 *
 * Responsibilities:
 *   - Build the hex-grid geometry and material once.
 *   - Every frame: for each spike read springField.getHeight(i) → scale Y.
 *
 * Zero simulation logic.
 * Zero audio logic.
 * Zero neighbor calculations.
 */
export default class SpikeRenderer extends THREE.InstancedMesh {
    /**
     * @param {object} opts
     * @param {number} [opts.count=2000]       - Number of spikes
     * @param {number} [opts.dishRadius=1.85]  - World radius of the petri dish
     * @param {number} [opts.baseY=0.08]       - Y position of the dish floor
     */
    constructor({ count = 2000, dishRadius = 1.85, baseY = 0.08 } = {}) {
        // ── 1. Generate hexagonal grid positions ──────────────────────────────
        const positions = SpikeRenderer._buildHexGrid(count, dishRadius, baseY);

        // ── 2. Geometry ───────────────────────────────────────────────────────
        // Recover spacing 'd' — approximate from the point density
        const area = Math.PI * dishRadius * dishRadius;
        // Hex grid cell area = (√3/2) * d²  →  d = sqrt(2A/(√3*N))
        const d = Math.sqrt((2 * area) / (Math.sqrt(3) * positions.length));

        const spikeRadius = d * 0.45;
        const spikeHeight = 0.1; // base unit height — scaled by spring each frame

        const geometry = new THREE.CylinderGeometry(spikeRadius, spikeRadius, spikeHeight, 8);
        // Translate origin to base so Y scale grows upward
        geometry.translate(0, spikeHeight / 2, 0);

        // ── 3. Material — premium black chrome ────────────────────────────────
        const material = new THREE.MeshPhysicalMaterial({
            color: 0x000000,
            metalness: 1.0,
            roughness: 0.08,
            clearcoat: 1.0,
            clearcoatRoughness: 0.02,
            envMapIntensity: 1.5,
        });

        // ── 4. InstancedMesh ──────────────────────────────────────────────────
        super(geometry, material, positions.length);
        this.castShadow    = true;
        this.receiveShadow = true;

        // Store base positions for matrix rebuild
        this._positions = positions;
        this._dummy     = new THREE.Object3D();

        // Set identity matrices for all instances at rest (height=1.0)
        const dummy = this._dummy;
        for (let i = 0; i < positions.length; i++) {
            dummy.position.copy(positions[i]);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            this.setMatrixAt(i, dummy.matrix);
        }
        this.instanceMatrix.needsUpdate = true;
    }

    /**
     * Rebuild instance matrices from SpringField heights.
     * Called every frame by the Engine.
     *
     * @param {import('../simulation/SpringField.js').default} springField
     */
    render(springField) {
        const dummy     = this._dummy;
        const positions = this._positions;
        const count     = positions.length;

        for (let i = 0; i < count; i++) {
            const h = springField.getHeight(i);
            dummy.position.copy(positions[i]);
            dummy.scale.set(1, h, 1);
            dummy.updateMatrix();
            this.setMatrixAt(i, dummy.matrix);
        }

        this.instanceMatrix.needsUpdate = true;
    }

    /** Public accessor for the hex grid positions (used by SpringField constructor). */
    get positions() {
        return this._positions;
    }

    // ── Static helper ─────────────────────────────────────────────────────────
    static _buildHexGrid(numSpikes, dishRadius, baseY) {
        let bestPoints = [];
        let minD = 0.01, maxD = 0.2;

        for (let iter = 0; iter < 40; iter++) {
            const d    = (minD + maxD) / 2;
            const pts  = [];
            const rowH = d * Math.sqrt(3) / 2;
            const maxI = Math.ceil(dishRadius / rowH);

            for (let i = -maxI; i <= maxI; i++) {
                const z       = i * rowH;
                const xOffset = (Math.abs(i) % 2) * (d / 2);
                const maxJ    = Math.ceil(dishRadius / d) + 1;

                for (let j = -maxJ; j <= maxJ; j++) {
                    const x = j * d + xOffset;
                    if (x * x + z * z <= dishRadius * dishRadius) {
                        pts.push(new THREE.Vector3(x, baseY, z));
                    }
                }
            }

            if (pts.length >= numSpikes) {
                bestPoints = pts;
                minD       = d;
            } else {
                maxD       = d;
            }
        }

        // Sort by distance from center, take exactly numSpikes
        bestPoints.sort((a, b) => (a.x*a.x + a.z*a.z) - (b.x*b.x + b.z*b.z));
        return bestPoints.slice(0, numSpikes);
    }
}

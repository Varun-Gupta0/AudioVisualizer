import * as THREE from 'three';

export default class SpikeField extends THREE.InstancedMesh {
    constructor() {
        const numSpikes = 2000;
        const dishRadius = 1.85; // Slightly smaller than the petri dish inner wall (1.92)
        const baseHeight = 0.08; // Exactly at the top of the petri dish floor
        
        // 1. Generate Hexagonal Grid
        let points = [];
        let bestPoints = [];
        let minD = 0.01;
        let maxD = 0.2;
        let d = 0.05;
        
        // Binary search to find optimal spacing 'd' that fits >= 2000 spikes inside the radius
        for (let iter = 0; iter < 40; iter++) {
            d = (minD + maxD) / 2;
            points = [];
            
            // Hex grid row height is d * sqrt(3)/2
            const rowHeight = d * Math.sqrt(3) / 2;
            const maxI = Math.ceil(dishRadius / rowHeight);
            
            for (let i = -maxI; i <= maxI; i++) {
                const z = i * rowHeight;
                // Offset every other row by half the spacing for hexagonal packing
                const xOffset = (Math.abs(i) % 2) * (d / 2);
                const maxJ = Math.ceil(dishRadius / d) + 1;
                
                for (let j = -maxJ; j <= maxJ; j++) {
                    const x = j * d + xOffset;
                    // Check if center is inside the circular dish
                    if (x * x + z * z <= dishRadius * dishRadius) {
                        points.push(new THREE.Vector3(x, baseHeight, z));
                    }
                }
            }
            
            if (points.length >= numSpikes) {
                bestPoints = [...points]; // Save valid array
                minD = d; // Spacing is small enough to fit the points, try slightly larger to get closer to exactly numSpikes
            } else {
                maxD = d; // Spacing too large, try smaller
            }
        }
        
        // Use the best array that had at least numSpikes
        points = bestPoints;
        
        // Sort points by distance from center to get a perfect circular crop
        points.sort((a, b) => (a.x * a.x + a.z * a.z) - (b.x * b.x + b.z * b.z));
        points = points.slice(0, numSpikes);

        // 2. Create Geometry
        // Set radius slightly less than half of spacing 'd' to prevent overlaps
        const spikeRadius = d * 0.45; 
        const spikeHeight = 0.1; // Static uniform height for all spikes
        
        const geometry = new THREE.CylinderGeometry(spikeRadius, spikeRadius, spikeHeight, 16);
        // Shift geometry origin to its base so scaling/positioning works upwards
        geometry.translate(0, spikeHeight / 2, 0);

        // 3. Create Premium Black Ferrofluid Material
        // Black chrome, glossy, reflective, strong specular highlights
        const material = new THREE.MeshPhysicalMaterial({
            color: 0x000000,          // Pure black base
            metalness: 1.0,           // Full chrome reflectivity
            roughness: 0.08,          // Very low roughness for glossy reflections
            clearcoat: 1.0,           // Strong specular layer on top
            clearcoatRoughness: 0.02, // Extremely sharp clearcoat highlights
            envMapIntensity: 1.5      // Boost the reflections from the soft HDR environment
        });

        // Initialize InstancedMesh
        super(geometry, material, numSpikes);

        // 4. Position and initialize physics for all instances
        this.basePositions = points;
        this.currentHeights = new Float32Array(numSpikes).fill(1.0);
        this.targetHeights = new Float32Array(numSpikes).fill(1.0);
        this.velocities = new Float32Array(numSpikes).fill(0.0);

        // Precompute neighbors for viscosity/surface tension effect
        // d is approx 0.078. 1.5 * d captures the immediate 6 hexagonal neighbors.
        this.neighborRadius = d * 1.5; 
        this.influenceFactor = 0.3;    // 30% neighbor influence
        this.neighbors = [];

        const radiusSq = this.neighborRadius * this.neighborRadius;
        for (let i = 0; i < numSpikes; i++) {
            const n = [];
            const pI = points[i];
            for (let j = 0; j < numSpikes; j++) {
                if (i === j) continue;
                const pJ = points[j];
                const dx = pI.x - pJ.x;
                const dz = pI.z - pJ.z;
                if (dx*dx + dz*dz <= radiusSq) {
                    n.push(j);
                }
            }
            this.neighbors.push(new Uint16Array(n));
        }

        // Physics tuning for "heavy and smooth" feel
        this.tension = 80;    // Spring stiffness
        this.damping = 10;    // Friction/resistance
        this.mass = 3.0;      // High mass for heavy inertia

        // Neighbor influence configuration (tweakable)
        this.neighborRadius = d * 2.0;   // Larger radius for more neighbors
        this.influenceFactor = 0.5;      // 50% neighbor influence for smoother surface

        const dummy = new THREE.Object3D();
        for (let i = 0; i < numSpikes; i++) {
            dummy.position.copy(points[i]);
            dummy.scale.set(1, 1, 1);
            dummy.updateMatrix();
            this.setMatrixAt(i, dummy.matrix);
        }

        this.instanceMatrix.needsUpdate = true;
        this.castShadow = true;
        this.receiveShadow = true;
    }

    // Reusable spring animation engine update
    update(dt) {
        let needsUpdate = false;
        const dummy = new THREE.Object3D();

        // Prevent huge dt jumps from breaking physics if tab is inactive
        const safeDt = Math.min(dt, 0.05);

        // Simple testing: Randomly perturb a spike to verify motion
        if (Math.random() < 0.1) {
            const randomIdx = Math.floor(Math.random() * this.count);
            this.targetHeights[randomIdx] = 2.0 + Math.random() * 5.0; // Shoot up
        }
        // Slowly decay all targets back to 1.0 to simulate gravity/surface tension
        for (let i = 0; i < this.count; i++) {
            this.targetHeights[i] += (1.0 - this.targetHeights[i]) * 2.0 * safeDt;
        }

        // --- Viscosity pass: compute blended target for each spike ---
        const blendedTargets = new Float32Array(this.count);
        for (let i = 0; i < this.count; i++) {
            const ownTarget = this.targetHeights[i];
            const n = this.neighbors[i];
            const numNeighbors = n.length;
            if (numNeighbors === 0) {
                blendedTargets[i] = ownTarget;
                continue;
            }
            let sum = 0;
            for (let j = 0; j < numNeighbors; j++) {
                sum += this.currentHeights[n[j]];
            }
            const avgNeighborHeight = sum / numNeighbors;
            blendedTargets[i] = ownTarget * (1.0 - this.influenceFactor) + avgNeighborHeight * this.influenceFactor;
        }

        // Process spring physics for every spike using blended targets
        for (let i = 0; i < this.count; i++) {
            const h = this.currentHeights[i];
            const blendedTarget = blendedTargets[i];
            let v = this.velocities[i];

            // Hooke's Law with blended target
            const force = -this.tension * (h - blendedTarget) - this.damping * v;
            const acceleration = force / this.mass;

            // Euler integration
            v += acceleration * safeDt;
            let newH = h + v * safeDt;

            // Clamp minimum scale to a small non-zero to avoid matrix inversion errors
            if (newH < 0.05) {
                newH = 0.05;
                v = 0; // stop moving down
            }

            this.velocities[i] = v;
            
            // Only update matrix if there is meaningful movement
            if (Math.abs(newH - h) > 0.0001 || Math.abs(v) > 0.0001) {
                this.currentHeights[i] = newH;
                
                // Rebuild transform matrix
                dummy.position.copy(this.basePositions[i]);
                dummy.scale.set(1, newH, 1);
                dummy.updateMatrix();
                
                this.setMatrixAt(i, dummy.matrix);
                needsUpdate = true;
            }
        }

        if (needsUpdate) {
            this.instanceMatrix.needsUpdate = true;
        }
    }
}

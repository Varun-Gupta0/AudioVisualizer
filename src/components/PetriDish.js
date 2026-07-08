import * as THREE from 'three';

export default class PetriDish extends THREE.Mesh {
    constructor() {
        // Define the cross-section profile of the petri dish
        const path = new THREE.Path();
        const radius = 2.0;       // Outer radius
        const height = 0.4;       // Shallow height
        const wall = 0.08;        // Realistic thick glass wall
        const base = 0.08;        // Glass base thickness
        const bevel = wall / 2;   // Rounded bevel at the rim

        // Build the solid profile starting from bottom center
        path.moveTo(0, base); // Inner floor center
        path.lineTo(radius - wall - bevel, base); // Inner floor edge
        
        // Inner bottom corner curve
        path.quadraticCurveTo(radius - wall, base, radius - wall, base + bevel);
        
        // Inner wall straight up
        path.lineTo(radius - wall, height - bevel);
        
        // Top rounded rim
        // absarc(x, y, radius, startAngle, endAngle, clockwise)
        path.absarc(radius - wall / 2, height - bevel, wall / 2, Math.PI, 0, true);
        
        // Outer wall straight down
        path.lineTo(radius, bevel);
        
        // Outer bottom corner curve
        path.quadraticCurveTo(radius, 0, radius - bevel, 0);
        
        // Outer floor back to center
        path.lineTo(0, 0);

        // Revolve the path into a solid 3D geometry
        // 128 segments ensures perfectly smooth, high-end curved reflections
        const points = path.getPoints(60);
        const geometry = new THREE.LatheGeometry(points, 128);

        // Premium physically-based glass material
        const material = new THREE.MeshPhysicalMaterial({
            color: 0xffffff,
            metalness: 0.0,
            roughness: 0.02,        // Extremely smooth surface
            transmission: 1.0,      // Fully transparent (glass)
            thickness: 0.5,         // Volumetric thickness for realistic refraction
            ior: 1.52,              // Standard index of refraction for glass
            clearcoat: 1.0,         // Extra glossy layer on top
            clearcoatRoughness: 0.0,
            transparent: true,
            opacity: 1.0,
            side: THREE.FrontSide
        });

        super(geometry, material);

        this.castShadow = true;
        this.receiveShadow = true;
    }
}

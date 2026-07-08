import * as THREE from 'three';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';

/**
 * Lighting — isolated lighting setup for the Liquid Depth scene.
 * No simulation logic. No rendering loop. Add result to any scene.
 */
export default class Lighting extends THREE.Group {
    constructor() {
        super();

        RectAreaLightUniformsLib.init();

        // 1. Soft Area Light (Key Light)
        // Provides beautiful rectangular reflections on glossy surfaces
        const areaLight = new THREE.RectAreaLight(0xffffff, 4.0, 5, 5);
        areaLight.position.set(0, 5, 2);
        areaLight.lookAt(0, 0, 0);
        this.add(areaLight);

        // 2. Rim / Backlight (SpotLight)
        // Separates the subject from the black background with a sharp edge
        const rimLight = new THREE.SpotLight(0xffffff, 80, 0, Math.PI / 4, 0.5, 2.0);
        rimLight.position.set(-4, 3, -4);
        rimLight.lookAt(0, 0, 0);
        rimLight.castShadow = true;
        rimLight.shadow.mapSize.width  = 2048;
        rimLight.shadow.mapSize.height = 2048;
        rimLight.shadow.bias   = -0.0001;
        rimLight.shadow.radius = 4;
        this.add(rimLight);
    }
}

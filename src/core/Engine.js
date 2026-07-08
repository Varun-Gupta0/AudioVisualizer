import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// Scene
import PetriDish from '../scene/PetriDish.js';
import Lighting from '../scene/Lighting.js';

// Simulation
import HeightField from '../simulation/HeightField.js';
import Diffusion from '../simulation/Diffusion.js';
import AudioAnalyser from '../simulation/AudioAnalyser.js';
import AttractorSystem from '../simulation/AttractorSystem.js';
import SpringField from '../simulation/SpringField.js';

// Rendering
import SpikeRenderer from '../rendering/SpikeRenderer.js';

/**
 * Engine — pure orchestrator.
 *
 * tick() order:
 *   audio → attractors → field → diffusion → springs → render
 *
 * No simulation logic lives here.
 * No rendering logic lives here.
 */
export default class Engine {
    constructor(container) {
        this.container = container;

        // ── WebGL Renderer ──────────────────────────────────────────────────
        this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.2;
        this.renderer.shadowMap.enabled = true;
        this.renderer.shadowMap.type = THREE.PCFShadowMap;
        container.appendChild(this.renderer.domElement);

        // ── Scene ──────────────────────────────────────────────────────────
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);

        // Soft HDR environment map
        const pmrem = new THREE.PMREMGenerator(this.renderer);
        pmrem.compileEquirectangularShader();
        this.scene.environment = pmrem.fromScene(new RoomEnvironment()).texture;

        // ── Camera ─────────────────────────────────────────────────────────
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
        this.camera.position.set(0, 3, 6);

        // ── Controls ───────────────────────────────────────────────────────
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.05;
        this.controls.enablePan = false;
        this.controls.minDistance = 2;
        this.controls.maxDistance = 20;

        // ── Scene objects ──────────────────────────────────────────────────
        this.scene.add(new PetriDish());
        this.scene.add(new Lighting());

        // ── Simulation layer ───────────────────────────────────────────────
        this.field     = new HeightField(80, 80, 1.85);
        this.diffusion = new Diffusion({ passes: 2, decay: 0.88 });
        this.audio     = new AudioAnalyser(1024);
        this.attractors = new AttractorSystem({ demoMode: true }); // demo until mic connected

        // ── Rendering layer ────────────────────────────────────────────────
        this.spikeRenderer = new SpikeRenderer({ count: 2000, dishRadius: 1.85, baseY: 0.08 });
        this.scene.add(this.spikeRenderer);

        // SpringField reads from the same positions used by SpikeRenderer
        this.springs = new SpringField(this.spikeRenderer.positions, {
            tension: 80,
            damping: 10,
            mass: 3.0,
            restHeight: 1.0,
        });

        // ── Timer (lightweight, avoids deprecated THREE.Clock) ────────────────
        this._lastTime = performance.now();
        this._getDelta = () => {
            const now = performance.now();
            const dt  = Math.min((now - this._lastTime) / 1000, 0.05);
            this._lastTime = now;
            return dt;
        };

        // ── Events ─────────────────────────────────────────────────────────
        window.addEventListener('resize', this.onResize.bind(this));

        // ── Loop ───────────────────────────────────────────────────────────
        this.renderer.setAnimationLoop(this.tick.bind(this));
    }

    tick() {
        const dt     = this._getDelta();
        const energy = this.audio.getBandEnergy();           // { bass, mid, treble } 0–1

        // 1. Attractors stamp Gaussian bumps onto the field
        this.attractors.update(this.field, energy, dt);

        // 2. Diffusion spreads energy across neighboring cells
        this.diffusion.apply(this.field);

        // 3. Springs stabilize to sampled field values
        this.springs.update(this.field, dt);

        // 4. Renderer reads spring heights — no simulation logic
        this.spikeRenderer.render(this.springs);

        // 5. Three.js draw call
        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    }
}

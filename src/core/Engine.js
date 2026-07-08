import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RectAreaLightUniformsLib } from 'three/examples/jsm/lights/RectAreaLightUniformsLib.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export default class Engine {
  constructor(container) {
    this.container = container;
    
    // Core components
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x000000); // Deep black environment
    
    // Camera - 45 FOV for a flatter, more cinematic perspective
    this.camera = new THREE.PerspectiveCamera(
      45, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      100
    );
    this.camera.position.set(0, 2, 6);

    // Renderer - Premium settings for visual fidelity
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    
    // Cinematic tone mapping
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.2;
    
    // Soft shadows
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.container.appendChild(this.renderer.domElement);

    // Soft HDR Environment Lighting via RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    this.scene.environment = pmremGenerator.fromScene(new RoomEnvironment()).texture;

    // Camera Controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.enablePan = false;
    this.controls.minDistance = 2;
    this.controls.maxDistance = 20;

    // Scene Lighting setup
    this.setupLighting();

    // Event listeners
    window.addEventListener('resize', this.onResize.bind(this));

    // Animation Loop
    this.renderer.setAnimationLoop(this.tick.bind(this));
  }

  setupLighting() {
    // Required for RectAreaLight to look correct
    RectAreaLightUniformsLib.init();

    // 1. Soft Area Light (Key Light)
    // Provides beautiful rectangular reflections on glossy surfaces
    const areaLight = new THREE.RectAreaLight(0xffffff, 4.0, 5, 5);
    areaLight.position.set(0, 5, 2);
    areaLight.lookAt(0, 0, 0);
    this.scene.add(areaLight);

    // 2. Rim Light (Backlight)
    // Helps separate subjects from the black background with a sharp, bright edge
    // SpotLight(color, intensity, distance, angle, penumbra, decay)
    const rimLight = new THREE.SpotLight(0xffffff, 80, 0, Math.PI / 4, 0.5, 2.0);
    rimLight.position.set(-4, 3, -4);
    rimLight.lookAt(0, 0, 0);
    
    // Enable soft shadows for the rim light
    rimLight.castShadow = true;
    rimLight.shadow.mapSize.width = 2048;
    rimLight.shadow.mapSize.height = 2048;
    rimLight.shadow.bias = -0.0001;
    rimLight.shadow.radius = 4; // Blurs the shadow edges
    
    this.scene.add(rimLight);
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  tick() {
    // Required for orbit controls damping
    this.controls.update(); 
    
    this.renderer.render(this.scene, this.camera);
  }
}

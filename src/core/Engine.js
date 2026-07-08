import * as THREE from 'three';

export default class Engine {
  constructor(container) {
    this.container = container;
    
    // Core components
    this.scene = new THREE.Scene();
    
    // Camera
    this.camera = new THREE.PerspectiveCamera(
      75, 
      window.innerWidth / window.innerHeight, 
      0.1, 
      1000
    );
    this.camera.position.z = 5;

    // Renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.container.appendChild(this.renderer.domElement);

    // Event listeners
    window.addEventListener('resize', this.onResize.bind(this));

    // Animation Loop
    this.renderer.setAnimationLoop(this.tick.bind(this));
  }

  onResize() {
    this.camera.aspect = window.innerWidth / window.innerHeight;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  }

  tick() {
    // Perform updates here before rendering
    
    this.renderer.render(this.scene, this.camera);
  }
}

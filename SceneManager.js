export class SceneManager {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    
    // Add fog for distance fade-out and to simulate atmosphere
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.005);

    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('gameCanvas'),
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Optimization: detect device memory and set optimal pixel ratio
    const deviceMemory = navigator.deviceMemory || 4;
    const optimalPixelRatio = deviceMemory <= 2 ? 1 : Math.min(window.devicePixelRatio, 2);
    this.deviceMemory = deviceMemory;
    this.renderer.setPixelRatio(optimalPixelRatio);

    // Shadows disabled for performance
    this.renderer.shadowMap.enabled = false;
    
    this.setupLights();
    
    this.handleResize();
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);
    
    // Add a hemisphere light for more natural outdoor lighting
    const hemisphereLight = new THREE.HemisphereLight(0x87ceeb, 0x444444, 0.4);
    this.scene.add(hemisphereLight);
  }

  updateFogForBiome(biomeColor) {
    // Adjust fog color to match biome
    const fogColor = new THREE.Color(biomeColor);
    // Blend with sky color
    fogColor.lerp(new THREE.Color(0x87ceeb), 0.5);
    this.scene.fog.color.copy(fogColor);
  }

  handleResize() {
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
    });
  }

  render(camera) {
    this.camera = camera; // Store reference for resize handler
    this.renderer.render(this.scene, camera);
  }
}
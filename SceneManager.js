export class SceneManager {
  constructor(camera) {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);
    // AAA: Fog for depth
    this.scene.fog = new THREE.FogExp2(0x87ceeb, 0.012);

    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('gameCanvas'),
      antialias: true,
      powerPreference: "high-performance"
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    
    // Optimization: detect device memory and set optimal pixel ratio
    const deviceMemory = navigator.deviceMemory || 4;
    const optimalPixelRatio = deviceMemory <= 2 ? 1 : Math.min(window.devicePixelRatio, 2);
    this.deviceMemory = deviceMemory;
    this.renderer.setPixelRatio(optimalPixelRatio);

    // AAA: Enable Shadows and Physically Correct Lights
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    
    this.setupLights();
    this.setupGround();
    
    // AAA: Post-Processing (Bloom)
    this.composer = new THREE.EffectComposer(this.renderer);
    const renderPass = new THREE.RenderPass(this.scene, camera);
    this.composer.addPass(renderPass);

    const bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5, 0.4, 0.85
    );
    bloomPass.threshold = 0.7;
    bloomPass.strength = 0.4; // Subtle glow
    bloomPass.radius = 0.5;
    this.composer.addPass(bloomPass);

    this.handleResize(camera);
  }

  setupLights() {
    // Hemisphere light for nice ambient gradient
    const ambientLight = new THREE.HemisphereLight(0xffffff, 0x444444, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 1.2);
    directionalLight.position.set(50, 100, 50);
    directionalLight.castShadow = true;
    
    // High quality shadow settings
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    directionalLight.shadow.camera.near = 0.5;
    directionalLight.shadow.camera.far = 500;
    
    const d = 150;
    directionalLight.shadow.camera.left = -d;
    directionalLight.shadow.camera.right = d;
    directionalLight.shadow.camera.top = d;
    directionalLight.shadow.camera.bottom = -d;
    directionalLight.shadow.bias = -0.0001;

    this.scene.add(directionalLight);
  }

  setupGround() {
    const groundGeometry = new THREE.PlaneGeometry(2000, 2000);
    // AAA: Standard Material for PBR lighting
    const groundMaterial = new THREE.MeshStandardMaterial({ 
        color: 0x5fa05f, 
        roughness: 0.9,
        metalness: 0.1
    });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    this.scene.add(groundMesh);

    // Aesthetic grid overlay
    const gridHelper = new THREE.GridHelper(2000, 200, 0x000000, 0x000000);
    gridHelper.material.opacity = 0.1;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);
  }

  handleResize(camera) {
    window.addEventListener('resize', () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      this.renderer.setSize(width, height);
      this.composer.setSize(width, height);
    });
  }

  render() {
    this.composer.render();
  }
}


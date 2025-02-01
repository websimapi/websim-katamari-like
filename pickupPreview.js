export class PickupPreview {
  constructor() {
    // Get the canvas and set up the renderer
    this.canvas = document.getElementById('pickup-canvas');
    this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, alpha: true, antialias: true });
    this.renderer.setSize(this.canvas.clientWidth, this.canvas.clientHeight);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, this.canvas.clientWidth / this.canvas.clientHeight, 0.1, 100);
    this.camera.position.set(0, 0, 3);
    // Add some light
    const ambientLight = new THREE.AmbientLight(0xffffff, 1);
    this.scene.add(ambientLight);
    // Container for the currently displayed pickup
    this.previewObject = null;
    // Bind animation
    this.animate = this.animate.bind(this);
    this.lastTime = performance.now();
    requestAnimationFrame(this.animate);
  }

  update(objectMesh, name) {
    // Remove old preview object if any
    if (this.previewObject) {
      this.scene.remove(this.previewObject);
      this.previewObject.traverse(child => {
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(mat => mat.dispose());
          } else {
            child.material.dispose();
          }
        }
      });
      this.previewObject = null;
    }
    // Clone the mesh to display. Center it.
    this.previewObject = objectMesh.clone();
    this.previewObject.position.set(0, 0, 0);
    // Scale the preview to fit within our view
    const box = new THREE.Box3().setFromObject(this.previewObject);
    const size = box.getSize(new THREE.Vector3()).length();
    const scaleFactor = 1.0 / size;
    this.previewObject.scale.setScalar(scaleFactor);
    // Adjust position so that object is centered
    box.getCenter(this.previewObject.position).multiplyScalar(-1);
    this.scene.add(this.previewObject);
    // Update name in UI
    const nameEl = document.getElementById('pickup-name');
    nameEl.textContent = name;
  }

  animate() {
    const currentTime = performance.now();
    const delta = (currentTime - this.lastTime) / 1000;
    this.lastTime = currentTime;
    if (this.previewObject) {
      // Rotate the preview object for a dynamic effect
      this.previewObject.rotation.y += delta * 1; // 1 radian per second
    }
    this.renderer.render(this.scene, this.camera);
    requestAnimationFrame(this.animate);
  }
}
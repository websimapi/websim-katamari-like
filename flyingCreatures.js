export class FlyingCreature {
  constructor(scene, type, startPosition) {
    this.scene = scene;
    this.type = type;
    this.startPosition = startPosition.clone();
    this.object = new THREE.Group();
    this.createGeometry();
    this.scene.add(this.object);
    this.timeOffset = Math.random() * Math.PI * 2;
  }

  createGeometry() {
    if(this.type === 'butterfly') {
      // Butterfly: small body and two wings
      const bodyGeometry = new THREE.SphereGeometry(0.1, 8, 8);
      const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      this.object.add(body);

      const wingGeometry = new THREE.PlaneGeometry(0.3, 0.2);
      const wingMaterial = new THREE.MeshBasicMaterial({ color: 0xffaaff, side: THREE.DoubleSide });
      const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
      leftWing.position.set(-0.15, 0, 0);
      leftWing.rotation.y = Math.PI / 4;
      const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
      rightWing.position.set(0.15, 0, 0);
      rightWing.rotation.y = -Math.PI / 4;

      this.object.add(leftWing);
      this.object.add(rightWing);
    } else if (this.type === 'eagle') {
      // Eagle: larger bird, a box body with spread wings
      const bodyGeometry = new THREE.BoxGeometry(0.3, 0.15, 0.6);
      const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      this.object.add(body);
      
      const wingGeometry = new THREE.PlaneGeometry(0.5, 0.3);
      const wingMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513, side: THREE.DoubleSide });
      const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
      leftWing.position.set(-0.25, 0, -0.1);
      leftWing.rotation.set(0, 0, Math.PI / 6);
      const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
      rightWing.position.set(0.25, 0, -0.1);
      rightWing.rotation.set(0, 0, -Math.PI / 6);

      this.object.add(leftWing);
      this.object.add(rightWing);
    } else if (this.type === 'bee') {
      // Bee: small insect with yellow body and a stripe
      const bodyGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
      const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      this.object.add(body);

      const stripeGeometry = new THREE.BoxGeometry(0.12, 0.3, 0.01);
      const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
      stripe.position.set(0, 0, 0.15);
      this.object.add(stripe);
    }
    // Set initial position
    this.object.position.copy(this.startPosition);
  }

  update(time) {
    // Animate the flying creature with a gentle oscillation and circular lateral movement.
    const amplitude = 2;
    const frequency = 0.5;
    const offsetY = Math.sin(time * frequency + this.timeOffset) * amplitude;
    const offsetX = Math.cos(time * frequency + this.timeOffset) * 1;
    this.object.position.x = this.startPosition.x + offsetX;
    this.object.position.y = this.startPosition.y + offsetY;
    // Slowly rotate the creature to simulate natural movement.
    this.object.rotation.y += 0.01;
  }

  dispose() {
    this.scene.remove(this.object);
    this.object.traverse(child => {
      if(child.geometry) child.geometry.dispose();
      if(child.material) {
        if(Array.isArray(child.material))
          child.material.forEach(mat => mat.dispose());
        else
          child.material.dispose();
      }
    });
  }
}
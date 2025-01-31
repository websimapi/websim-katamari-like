export class PlayerBall {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.collectedObjects = [];
    this.radius = 1;
    this.attachedMeshes = []; // Track attached objects
    
    // Three.js mesh
    this.geometry = new THREE.SphereGeometry(this.radius, 32, 32);
    this.material = new THREE.MeshPhongMaterial({ color: 0xFF69B4 });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    // Cannon.js body
    const shape = new CANNON.Sphere(this.radius);
    this.body = new CANNON.Body({
      mass: 5,
      shape: shape,
      position: new CANNON.Vec3(0, this.radius, 0),
      linearDamping: 0.4, // Add damping to slow down movement
      angularDamping: 0.4 // Add angular damping
    });
    world.addBody(this.body);
  }

  update() {
    // Update main ball position
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);

    // Update attached objects
    this.attachedMeshes.forEach(attached => {
      attached.mesh.position.copy(this.body.position);
      attached.mesh.quaternion.copy(this.body.quaternion);
      attached.mesh.position.add(attached.offset);
      attached.mesh.quaternion.multiply(attached.relativeRotation);
    });
  }

  applyForce(force) {
    // Scale force based on mass to maintain controllable speed
    const scaledForce = new CANNON.Vec3(
      force.x / (this.body.mass * 0.5),
      0,
      force.y / (this.body.mass * 0.5)
    );
    this.body.applyImpulse(scaledForce, this.body.position);
  }

  absorbObject(object) {
    this.scene.remove(object.mesh);
    this.world.remove(object.body);
    this.collectedObjects.push(object);
    
    // Create a new mesh for the absorbed object
    const attachedMesh = object.mesh.clone();
    
    // Calculate random offset position on the surface of the ball
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.random() * Math.PI;
    const offset = new THREE.Vector3(
      this.radius * Math.sin(theta) * Math.cos(phi),
      this.radius * Math.sin(theta) * Math.sin(phi),
      this.radius * Math.cos(theta)
    );

    // Random rotation
    const relativeRotation = new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      ));

    // Scale down the attached object slightly
    const scale = 0.8;
    attachedMesh.scale.set(scale, scale, scale);
    
    this.scene.add(attachedMesh);
    this.attachedMeshes.push({
      mesh: attachedMesh,
      offset: offset,
      relativeRotation: relativeRotation
    });
    
    // Increase ball size
    const objectVolume = (4/3) * Math.PI * Math.pow(object.body.shapes[0].radius, 3);
    const currentVolume = (4/3) * Math.PI * Math.pow(this.radius, 3);
    this.radius = Math.pow((currentVolume + objectVolume) * (3/(4*Math.PI)), 1/3);
    
    // Update physics body
    this.body.shapes[0].radius = this.radius;
    this.body.mass += object.body.mass;
    this.body.updateBoundingSphereRadius();
    this.body.updateMassProperties();
    
    // Update main ball geometry
    const newGeometry = new THREE.SphereGeometry(this.radius, 32, 32);
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;
  }

  getSize() {
    return this.radius * 2;
  }

  getCollectedCount() {
    return this.collectedObjects.length;
  }
}
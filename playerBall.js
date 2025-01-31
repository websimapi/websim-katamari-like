export class PlayerBall {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.collectedObjects = [];
    this.radius = 0.5;
    this.isBoosting = false;

    // Create the player mesh
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius, 32, 32),
      new THREE.MeshPhongMaterial({ color: 0xFF69B4, flatShading: true })
    );
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    // Create the physics body
    this.body = new CANNON.Body({
      mass: 2,
      shape: new CANNON.Sphere(this.radius),
      position: new CANNON.Vec3(0, this.radius, 0),
      linearDamping: 0.4,
      angularDamping: 0.4
    });
    world.addBody(this.body);

    // Keep track of attached meshes and their directions
    this.attachedMeshes = [];

    // Particle system for boost effect
    this.particleGroup = new THREE.Group();
    this.scene.add(this.particleGroup);
    this.particles = [];

    // Boost state
    this.boostEndTime = 0;
  }

  update() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);

    if (this.isBoosting) {
      this.emitParticles();
    }
    this.updateParticles();

    // Update boosting state
    this.isBoosting = performance.now() < this.boostEndTime;
  }

  applyForce(force) {
    const inputForceMagnitude = Math.sqrt(force.x * force.x + force.y * force.y);
    if (inputForceMagnitude > 0) {
      const normalizedForce = {
        x: force.x / inputForceMagnitude,
        y: force.y / inputForceMagnitude
      };

      const baseAcceleration = 20; 
      const boostMultiplier = 2;
      const currentTime = performance.now();

      const isBoosting = currentTime < this.boostEndTime;

      const acceleration = isBoosting ? baseAcceleration * boostMultiplier : baseAcceleration;

      const scaledForceMagnitude = this.body.mass * acceleration;
      const scaledForce = new CANNON.Vec3(
        normalizedForce.x * scaledForceMagnitude,
        0,
        normalizedForce.y * scaledForceMagnitude
      );

      this.body.applyForce(scaledForce, this.body.position);
    }
  }

  triggerBoost(duration) {
    this.boostEndTime = performance.now() + duration;
  }

  emitParticles() {
    const particleGeometry = new THREE.SphereGeometry(0.1, 8, 8);
    const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    particle.position.copy(this.mesh.position);

    // Position the particle behind the player
    const behindDirection = new THREE.Vector3(0, 0, -1);
    behindDirection.applyQuaternion(this.mesh.quaternion);
    particle.position.add(behindDirection.multiplyScalar(this.radius + 0.5));

    particle.lifeTime = 0.5; // seconds
    particle.createdAt = performance.now() / 1000; // current time in seconds

    this.particleGroup.add(particle);
    this.particles.push(particle);
  }

  updateParticles() {
    const currentTime = performance.now() / 1000;
    this.particles = this.particles.filter((particle) => {
      const age = currentTime - particle.createdAt;
      if (age > particle.lifeTime) {
        this.particleGroup.remove(particle);
        return false;
      } else {
        // Update particle properties (e.g., fade out)
        particle.material.opacity = 1 - (age / particle.lifeTime);
        particle.material.transparent = true;
        return true;
      }
    });
  }

  absorbObject(object) {
    if (!object || object.body.mass === 0) return;

    const objectSize =
      object.body.shapes[0].radius ||
      Math.max(
        object.body.shapes[0].halfExtents.x,
        object.body.shapes[0].halfExtents.y,
        object.body.shapes[0].halfExtents.z
      );

    if (objectSize >= this.radius) return;

    // Remove the original object from the scene and physics world
    this.scene.remove(object.mesh);
    this.world.removeBody(object.body);
    this.collectedObjects.push(object);

    // Create and attach the visual representation as a child of the player mesh
    const attachedMesh = object.mesh.clone();

    // Calculate random direction on the surface of the sphere
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.random() * Math.PI;
    const direction = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.sin(theta) * Math.sin(phi),
      Math.cos(theta)
    );

    // Set the position and rotation relative to the player mesh
    attachedMesh.position.copy(direction.clone().multiplyScalar(this.radius));
    attachedMesh.quaternion.set(
      Math.random(),
      Math.random(),
      Math.random(),
      Math.random()
    ).normalize();

    // Scale down the attached object slightly
    const scale = 0.6;
    attachedMesh.scale.set(scale, scale, scale);

    // Add the attached mesh as a child of the player mesh
    this.mesh.add(attachedMesh);

    // Keep track of the attached mesh and its direction
    this.attachedMeshes.push({
      mesh: attachedMesh,
      direction: direction
    });

    // Calculate new size based on combined volume
    const objectVolume = (4 / 3) * Math.PI * Math.pow(objectSize, 3);
    const currentVolume = (4 / 3) * Math.PI * Math.pow(this.radius, 3);
    const newVolume = currentVolume + objectVolume;
    const newRadius = Math.pow((3 * newVolume) / (4 * Math.PI), 1 / 3);

    // Update physics body
    this.radius = newRadius;
    this.body.shapes = [];
    this.body.addShape(new CANNON.Sphere(this.radius));
    this.body.mass += object.body.mass;
    this.body.updateMassProperties();
    this.body.aabbNeedsUpdate = true;

    // Update visual mesh
    const newGeometry = new THREE.SphereGeometry(this.radius, 32, 32);
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;

    // Reposition attached meshes based on new radius
    this.attachedMeshes.forEach(attached => {
      attached.mesh.position.copy(attached.direction.clone().multiplyScalar(this.radius));
    });
  }

  getSize() {
    return this.radius * 2;
  }

  getCollectedCount() {
    return this.collectedObjects.length;
  }
}
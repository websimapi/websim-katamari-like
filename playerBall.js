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

    // Keep track of attached meshes and their bodies
    this.attachedMeshes = [];

    // Create the main compound body
    this.compoundBody = new CANNON.Body({
      mass: 2,
      type: CANNON.Body.DYNAMIC,
      linearDamping: 0.4,
      angularDamping: 0.4
    });

    // Add the main sphere shape
    const sphereShape = new CANNON.Sphere(this.radius);
    this.compoundBody.addShape(sphereShape);
    this.compoundBody.position.set(0, this.radius, 0);

    // Replace this.body with this.compoundBody
    this.body = this.compoundBody;
    world.addBody(this.body);

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

    if (performance.now() < this.boostEndTime) {
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

      const baseAcceleration = 40; 
      const boostMultiplier = 5;   
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

  setBoosting(isBoosting) {
    if (!isBoosting) {
      this.boostEndTime = 0;
    }
  }

  emitParticles() {
    if (Math.random() > 0.3) return;

    const particleGeometry = new THREE.SphereGeometry(0.1, 4, 4);
    const particleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const particle = new THREE.Mesh(particleGeometry, particleMaterial);
    particle.position.copy(this.mesh.position);

    const behindDirection = new THREE.Vector3(0, 0, -1);
    behindDirection.applyQuaternion(this.mesh.quaternion);
    particle.position.add(behindDirection.multiplyScalar(this.radius + 0.5));

    particle.lifeTime = 0.5; 
    particle.createdAt = performance.now() / 1000; 

    this.particleGroup.add(particle);
    this.particles.push(particle);
  }

  updateParticles() {
    const currentTime = performance.now() / 1000;
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const particle = this.particles[i];
      const age = currentTime - particle.createdAt;
      if (age > particle.lifeTime) {
        this.particleGroup.remove(particle);
        particle.geometry.dispose();
        particle.material.dispose();
        this.particles.splice(i, 1);
      } else {
        particle.material.opacity = 1 - (age / particle.lifeTime);
        particle.material.transparent = true;
      }
    }
  }

  absorbObject(object) {
    if (!object || object.body.mass === 0) return;

    const objectShape = object.body.shapes[0];
    const objectSize = objectShape.radius || 
      Math.max(
        objectShape.halfExtents.x,
        objectShape.halfExtents.y,
        objectShape.halfExtents.z
      );

    if (objectSize >= this.radius) return;

    this.scene.remove(object.mesh);
    this.world.removeBody(object.body);
    this.collectedObjects.push(object);

    const attachedMesh = object.mesh.clone();

    const phi = Math.random() * Math.PI * 2;
    const theta = Math.random() * Math.PI;
    const direction = new THREE.Vector3(
      Math.sin(theta) * Math.cos(phi),
      Math.sin(theta) * Math.sin(phi),
      Math.cos(theta)
    );

    const attachPosition = direction.clone().multiplyScalar(this.radius);
    attachedMesh.position.copy(attachPosition);
    attachedMesh.scale.set(0.6, 0.6, 0.6);

    this.mesh.add(attachedMesh);

    let attachedShape;
    const scale = 0.6; 

    if (objectShape instanceof CANNON.Sphere) {
      attachedShape = new CANNON.Sphere(objectShape.radius * scale);
    } else if (objectShape instanceof CANNON.Box) {
      attachedShape = new CANNON.Box(new CANNON.Vec3(
        objectShape.halfExtents.x * scale,
        objectShape.halfExtents.y * scale,
        objectShape.halfExtents.z * scale
      ));
    }

    const offset = new CANNON.Vec3(
      attachPosition.x,
      attachPosition.y,
      attachPosition.z
    );

    this.body.addShape(attachedShape, offset);

    const addedMass = object.body.mass * 0.6; 
    const newMass = this.body.mass + addedMass;
    this.body.mass = newMass;
    this.body.updateMassProperties();

    // Store attached mesh along with its physics shape, offset, and mass contribution.
    this.attachedMeshes.push({
      mesh: attachedMesh,
      direction: direction,
      shape: attachedShape,
      offset: offset,
      mass: addedMass
    });

    const objectVolume = (4 / 3) * Math.PI * Math.pow(objectSize, 3);
    const currentVolume = (4 / 3) * Math.PI * Math.pow(this.radius, 3);
    const newVolume = currentVolume + objectVolume;
    const newRadius = Math.pow((3 * newVolume) / (4 * Math.PI), 1 / 3);

    this.radius = newRadius;
    this.body.shapes[0].radius = this.radius;

    const newGeometry = new THREE.SphereGeometry(this.radius, 32, 32);
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;

    this.attachedMeshes.forEach(attached => {
      const newPos = attached.direction.clone().multiplyScalar(this.radius);
      attached.mesh.position.copy(newPos);
    });
  }

  loseObjects(count) {
    // When the ball collides with a moving obstacle larger than itself,
    // lose a number of attached objects. These detached objects will be re-added
    // to the scene with their own physics and given an impulse.
    for (let i = 0; i < count; i++) {
      if (this.attachedMeshes.length === 0) break;
      const lost = this.attachedMeshes.pop();
      // Remove the attached mesh from the player ball
      this.mesh.remove(lost.mesh);

      // Subtract the object's mass contribution from the player's body
      this.body.mass -= lost.mass;
      this.body.updateMassProperties();

      // Get the world position of the lost object
      const worldPos = new THREE.Vector3();
      lost.mesh.getWorldPosition(worldPos);

      // Create a new physics body for the lost object using the same shape
      const lostBody = new CANNON.Body({
        mass: lost.mass,
        shape: lost.shape,
        position: new CANNON.Vec3(worldPos.x, worldPos.y, worldPos.z)
      });
      // Apply an impulse to simulate it flying off
      const impulse = new CANNON.Vec3(
        (Math.random() - 0.5) * 100,
        100,
        (Math.random() - 0.5) * 100
      );
      lostBody.applyImpulse(impulse, lostBody.position);

      // Re-add the lost mesh to the scene so it becomes an independent falling object
      this.scene.add(lost.mesh);
      this.world.addBody(lostBody);
    }
  }

  getSize() {
    return this.radius * 2;
  }

  getCollectedCount() {
    return this.collectedObjects.length;
  }
}
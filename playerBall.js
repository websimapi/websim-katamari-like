export class PlayerBall {
  constructor(scene, world, physicsManager) {
    this.scene = scene;
    this.world = world;
    this.physicsManager = physicsManager; // Store reference for material access
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
      angularDamping: 0.4,
      material: physicsManager.playerMaterial, // Use player material
      allowSleep: false // Never let the player sleep for continuous collision detection
    });

    // Add the main sphere shape
    const sphereShape = new CANNON.Sphere(this.radius);
    this.compoundBody.addShape(sphereShape);
    this.compoundBody.position.set(0, this.radius * 4, 0); // Start a bit higher
    
    // Increase collision detection precision
    this.compoundBody.collisionFilterGroup = 1;
    this.compoundBody.collisionFilterMask = 1;
    
    // Adjust more properties for better physics
    this.compoundBody.fixedRotation = false;
    this.compoundBody.updateMassProperties();

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

    const newMass = this.body.mass + (object.body.mass * 0.6); 
    this.body.mass = newMass;
    this.body.updateMassProperties();

    this.attachedMeshes.push({
      mesh: attachedMesh,
      direction: direction,
      shape: attachedShape,
      offset: offset
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

  absorbPlayer(peerRadius) {
    const objectVolume = (4 / 3) * Math.PI * Math.pow(peerRadius, 3);
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

  getSize() {
    return this.radius * 2;
  }

  getCollectedCount() {
    return this.collectedObjects.length;
  }
}
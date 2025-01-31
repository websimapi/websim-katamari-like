export class PlayerBall {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.collectedObjects = [];
    this.radius = 0.5; 
    this.mesh = new THREE.Mesh(
      new THREE.SphereGeometry(this.radius, 32, 32),
      new THREE.MeshPhongMaterial({ color: 0xFF69B4, flatShading: true })
    );
    this.mesh.castShadow = true;
    scene.add(this.mesh);

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

    // Movement variables
    this.moving = false;
    this.baseSpeed = 5;
    this.speedMultiplier = 1;
    this.maxSpeedMultiplier = 3;
    this.accelerationRate = 0.01; // Rate at which speed increases
    this.previousDirection = new THREE.Vector2(0, 0);

    // Accelerate action variables
    this.isAccelerateActive = false;
    this.accelerateMultiplier = 2; // Multiplier during accelerate
  }

  update() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);

    // Decay speed multiplier when not moving
    if (!this.moving && this.speedMultiplier > 1) {
      this.speedMultiplier -= this.accelerationRate;
      if (this.speedMultiplier < 1) {
        this.speedMultiplier = 1;
      }
    }

    // Adjust damping based on size to allow larger balls to maintain speed better
    this.body.linearDamping = Math.max(0.2, 1 - this.radius / 50); // Damping decreases with size
  }

  applyForce(force) {
    this.moving = true;

    // Calculate current direction
    const currentDirection = new THREE.Vector2(force.x, force.y).normalize();

    // Check if moving in the same direction
    if (currentDirection.dot(this.previousDirection) > 0.95) {
      // Increase speed multiplier up to max
      if (this.speedMultiplier < this.maxSpeedMultiplier) {
        this.speedMultiplier += this.accelerationRate;
      }
    } else {
      // Reset speed multiplier if direction changes
      this.speedMultiplier = 1;
    }

    // Save current direction
    this.previousDirection.copy(currentDirection);

    // Calculate total speed multiplier
    let totalMultiplier = this.speedMultiplier;
    if (this.isAccelerateActive) {
      totalMultiplier *= this.accelerateMultiplier;
    }

    // Apply force, adjust for mass and size to ensure larger balls can still move adequately
    const massFactor = Math.pow(this.body.mass, 0.5); // Adjust based on mass
    const appliedForce = new CANNON.Vec3(
      (force.x * totalMultiplier * this.baseSpeed) / massFactor,
      0,
      (force.y * totalMultiplier * this.baseSpeed) / massFactor
    );
    this.body.applyForce(appliedForce, this.body.position);
  }

  stopMoving() {
    this.moving = false;
  }

  activateAccelerate() {
    this.isAccelerateActive = true;
  }

  deactivateAccelerate() {
    this.isAccelerateActive = false;
  }

  absorbObject(object) {
    if (!object || object.body.mass === 0) return;

    const objectSize = object.body.shapes[0].radius || 
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
      Math.random(), Math.random(), Math.random(), Math.random()
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

    // Update mass proportional to volume
    this.body.mass = this.radius * this.radius * this.radius;
    this.body.updateMassProperties();

    // Update shape
    this.body.shapes = [];
    this.body.addShape(new CANNON.Sphere(this.radius));
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
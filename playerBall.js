export class PlayerBall {
  constructor(scene, world, cityGenerator) {
    this.scene = scene;
    this.world = world;
    this.cityGenerator = cityGenerator;
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

    // Bind collision event handler
    this.body.addEventListener('collide', this.handleCollision.bind(this));
  }

  update() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
    // Attached meshes are children of this.mesh and will rotate automatically
  }

  applyForce(force) {
    const scaledForce = new CANNON.Vec3(
      force.x / (this.body.mass * 0.5),
      0,
      force.y / (this.body.mass * 0.5)
    );
    this.body.applyImpulse(scaledForce, this.body.position);
  }

  handleCollision(event) {
    const otherBody = event.body;

    // Skip if other body is the ground (mass === 0)
    if (otherBody.mass === 0) return;

    // Find the object that corresponds to this physics body
    const object = Array.from(this.cityGenerator.objects.values())
      .flat()
      .find(obj => obj.body === otherBody);
    
    if (object) {
      const objectSize = object.body.shapes[0].radius || 
                       Math.max(
                         object.body.shapes[0].halfExtents.x,
                         object.body.shapes[0].halfExtents.y,
                         object.body.shapes[0].halfExtents.z
                       );
      
      // Only absorb if the object is smaller than the player
      if (objectSize < this.radius) {
        this.absorbObject(object);

        // Remove the object from the city generator's records
        for (let [key, objects] of this.cityGenerator.objects.entries()) {
          const index = objects.findIndex(obj => obj.body === otherBody);
          if (index !== -1) {
            objects.splice(index, 1);
            break;
          }
        }

        // Update UI
        document.getElementById('size-value').textContent = 
          this.getSize().toFixed(1);
        document.getElementById('score-value').textContent = 
          this.getCollectedCount();
      }
    }
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

    // Store current physics properties
    const position = this.body.position.clone();
    const velocity = this.body.velocity.clone();
    const angularVelocity = this.body.angularVelocity.clone();

    // Remove old body
    this.world.removeBody(this.body);

    // Create new body with updated radius and mass
    this.radius = newRadius;
    this.body = new CANNON.Body({
      mass: this.body.mass + object.body.mass,
      shape: new CANNON.Sphere(this.radius),
      position: position,
      linearDamping: 0.4,
      angularDamping: 0.4
    });
    this.body.velocity.copy(velocity);
    this.body.angularVelocity.copy(angularVelocity);
    this.world.addBody(this.body);

    // Reattach collision handler
    this.body.addEventListener('collide', this.handleCollision.bind(this));

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
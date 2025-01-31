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

  absorbObject(object) {
    if (!object || !object.body || object.body.mass === 0) return;

    const objectSize = object.body.shapes[0].radius || 
                      Math.max(
                        object.body.shapes[0].halfExtents.x,
                        object.body.shapes[0].halfExtents.y,
                        object.body.shapes[0].halfExtents.z
                      );

    if (objectSize >= this.radius) return;

    try {
      // Remove the original object from the scene and physics world
      if (object.mesh && object.mesh.parent) {
        object.mesh.parent.remove(object.mesh);
      }
      if (object.body && object.body.world) {
        object.body.world.removeBody(object.body);
      }
      this.collectedObjects.push(object);

      // Create and attach the visual representation
      const attachedMesh = object.mesh.clone();
      
      // Calculate random direction on the surface of the sphere
      const phi = Math.random() * Math.PI * 2;
      const theta = Math.random() * Math.PI;
      const direction = new THREE.Vector3(
        Math.sin(theta) * Math.cos(phi),
        Math.sin(theta) * Math.sin(phi),
        Math.cos(theta)
      );

      // Position the attached mesh on the surface of the ball
      attachedMesh.position.copy(direction.multiplyScalar(this.radius));
      
      // Random rotation for variety
      attachedMesh.quaternion.setFromEuler(new THREE.Euler(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      ));

      // Scale down the attached object slightly
      const scale = 0.6;
      attachedMesh.scale.set(scale, scale, scale);

      this.mesh.add(attachedMesh);
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
      const newShape = new CANNON.Sphere(this.radius);
      this.body.shapes = [newShape];
      this.body.mass += object.body.mass;
      this.body.updateMassProperties();

      // Update visual mesh
      const newGeometry = new THREE.SphereGeometry(this.radius, 32, 32);
      this.mesh.geometry.dispose();
      this.mesh.geometry = newGeometry;

      // Reposition attached meshes based on new radius
      this.attachedMeshes.forEach(attached => {
        attached.mesh.position.copy(attached.direction.multiplyScalar(this.radius));
      });
    } catch (error) {
      console.error('Error in absorbObject:', error);
    }
  }

  getSize() {
    return this.radius * 2;
  }

  getCollectedCount() {
    return this.collectedObjects.length;
  }
}
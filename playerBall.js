export class PlayerBall {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.collectedObjects = [];
    this.radius = 0.5; 
    this.attachedMeshes = []; 
    
    this.geometry = new THREE.SphereGeometry(this.radius, 32, 32);
    this.material = new THREE.MeshPhongMaterial({ 
      color: 0xFF69B4,
      flatShading: true
    });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    this.mesh.castShadow = true;
    scene.add(this.mesh);

    const shape = new CANNON.Sphere(this.radius);
    this.body = new CANNON.Body({
      mass: 2, 
      shape: shape,
      position: new CANNON.Vec3(0, this.radius, 0),
      linearDamping: 0.4,
      angularDamping: 0.4
    });
    world.addBody(this.body);
  }

  update() {
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);

    this.attachedMeshes.forEach(attached => {
      attached.mesh.position.copy(this.body.position);
      attached.mesh.quaternion.copy(this.body.quaternion);
      attached.mesh.position.add(attached.offset);
      attached.mesh.quaternion.multiply(attached.relativeRotation);
    });
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
    
    // Create and attach the visual representation
    const attachedMesh = object.mesh.clone();
    
    // Calculate random position on the surface of the ball
    const phi = Math.random() * Math.PI * 2;
    const theta = Math.random() * Math.PI;
    const offset = new THREE.Vector3(
      this.radius * Math.sin(theta) * Math.cos(phi),
      this.radius * Math.sin(theta) * Math.sin(phi),
      this.radius * Math.cos(theta)
    );

    const relativeRotation = new THREE.Quaternion()
      .setFromEuler(new THREE.Euler(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      ));

    // Scale down the attached object slightly
    const scale = 0.6;
    attachedMesh.scale.set(scale, scale, scale);
    
    this.scene.add(attachedMesh);
    this.attachedMeshes.push({
      mesh: attachedMesh,
      offset: offset,
      relativeRotation: relativeRotation
    });
    
    // Calculate new size based on volume
    const objectVolume = (4/3) * Math.PI * Math.pow(objectSize, 3);
    const currentVolume = (4/3) * Math.PI * Math.pow(this.radius, 3);
    const newVolume = currentVolume + objectVolume;
    const newRadius = Math.pow((3 * newVolume) / (4 * Math.PI), 1/3);
    
    // Update physics body
    this.radius = newRadius;
    
    // Remove old shape properly
    if (this.body.shapes.length > 0) {
      this.body.removeShape(this.body.shapes[0]);
    }
    // Add new shape with updated radius
    const newShape = new CANNON.Sphere(this.radius);
    this.body.addShape(newShape);

    this.body.mass += object.body.mass;
    this.body.updateMassProperties();
    this.body.aabbNeedsUpdate = true;
    
    // Update visual mesh
    const newGeometry = new THREE.SphereGeometry(this.radius, 32, 32);
    this.mesh.geometry.dispose();
    this.mesh.geometry = newGeometry;

    // Reposition attached meshes based on new radius
    this.attachedMeshes.forEach(attached => {
      attached.offset.normalize().multiplyScalar(this.radius);
    });
  }

  getSize() {
    return this.radius * 2;
  }

  getCollectedCount() {
    return this.collectedObjects.length;
  }
}
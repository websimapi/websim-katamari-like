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
    if (object.body.mass === 0) return;
    
    const objectSize = object.body.shapes[0].radius || 
                      Math.max(
                        object.body.shapes[0].halfExtents.x,
                        object.body.shapes[0].halfExtents.y,
                        object.body.shapes[0].halfExtents.z
                      );
                      
    if (objectSize >= this.radius) return;

    this.scene.remove(object.mesh);
    this.world.remove(object.body);
    this.collectedObjects.push(object);
    
    const attachedMesh = object.mesh.clone();
    
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

    const scale = 0.6;
    attachedMesh.scale.set(scale, scale, scale);
    
    this.scene.add(attachedMesh);
    this.attachedMeshes.push({
      mesh: attachedMesh,
      offset: offset,
      relativeRotation: relativeRotation
    });
    
    const growthFactor = 0.2; 
    const objectVolume = object.body.mass;
    const currentVolume = this.body.mass;
    this.radius *= (1 + (objectVolume / currentVolume) * growthFactor);
    
    this.body.shapes[0].radius = this.radius;
    this.body.mass += object.body.mass;
    this.body.updateBoundingSphereRadius();
    this.body.updateMassProperties();
    
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
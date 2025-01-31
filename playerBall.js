export class PlayerBall {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.collectedObjects = [];
    this.radius = 1;
    
    // Three.js mesh
    this.geometry = new THREE.SphereGeometry(this.radius, 32, 32);
    this.material = new THREE.MeshPhongMaterial({ color: 0xFF69B4 });
    this.mesh = new THREE.Mesh(this.geometry, this.material);
    scene.add(this.mesh);

    // Cannon.js body
    const shape = new CANNON.Sphere(this.radius);
    this.body = new CANNON.Body({
      mass: 5,
      shape: shape,
      position: new CANNON.Vec3(0, this.radius, 0)
    });
    world.addBody(this.body);
  }

  update() {
    // Update mesh position to match physics body
    this.mesh.position.copy(this.body.position);
    this.mesh.quaternion.copy(this.body.quaternion);
  }

  applyForce(force) {
    this.body.applyImpulse(
      new CANNON.Vec3(force.x, 0, force.y),
      this.body.position
    );
  }

  absorbObject(object) {
    this.scene.remove(object.mesh);
    this.world.remove(object.body);
    this.collectedObjects.push(object);
    
    // Increase ball size
    const objectVolume = (4/3) * Math.PI * Math.pow(object.body.shapes[0].radius, 3);
    const currentVolume = (4/3) * Math.PI * Math.pow(this.radius, 3);
    this.radius = Math.pow((currentVolume + objectVolume) * (3/(4*Math.PI)), 1/3);
    
    // Update physics body and mesh
    this.body.shapes[0].radius = this.radius;
    this.body.updateBoundingSphereRadius();
    
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
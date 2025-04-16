export class PhysicsManager {
  constructor() {
    this.world = new CANNON.World();
    this.setupPhysicsWorld();
  }

  setupPhysicsWorld() {
    // Strengthen gravity for realism
    this.world.gravity.set(0, -40, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 10;
    this.world.defaultContactMaterial.friction = 0.5;
    this.world.defaultContactMaterial.restitution = 0.3;
  }

  addGround() {
    const groundShape = new CANNON.Plane();
    const groundBody = new CANNON.Body({
      mass: 0,
      shape: groundShape
    });
    groundBody.quaternion.setFromAxisAngle(
      new CANNON.Vec3(1, 0, 0),
      -Math.PI / 2
    );
    this.world.addBody(groundBody);
    return groundBody;
  }

  step(fixedTimeStep, delta, maxSubSteps) {
    this.world.step(fixedTimeStep, delta, maxSubSteps);
  }
}


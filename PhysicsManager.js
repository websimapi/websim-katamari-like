export class PhysicsManager {
  constructor() {
    this.world = new CANNON.World();
    this.setupPhysicsWorld();
    this.terrainMaterials = [];
  }

  setupPhysicsWorld() {
    // Strengthen gravity for realism but not too strong to prevent falling through
    this.world.gravity.set(0, -30, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 20; // Increased from 10 for better precision
    this.world.defaultContactMaterial.friction = 0.5;
    this.world.defaultContactMaterial.restitution = 0.3;
    
    // Create player material to be used later
    this.playerMaterial = new CANNON.Material('player');
    
    // Create a default contact material for terrain-player interactions
    const defaultContactMaterial = new CANNON.ContactMaterial(
      this.playerMaterial,
      new CANNON.Material('default'),
      {
        friction: 0.5,
        restitution: 0.3,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3,
        frictionEquationStiffness: 1e8
      }
    );
    this.world.addContactMaterial(defaultContactMaterial);
  }

  addTerrainMaterial(terrainMaterial) {
    // Store terrain material reference
    this.terrainMaterials.push(terrainMaterial);
    
    // Create contact material between player and this terrain piece
    const contactMaterial = new CANNON.ContactMaterial(
      this.playerMaterial,
      terrainMaterial,
      {
        friction: 0.75,
        restitution: 0.2,
        contactEquationStiffness: 1e8,
        contactEquationRelaxation: 3,
        frictionEquationStiffness: 1e8
      }
    );
    this.world.addContactMaterial(contactMaterial);
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
    // Increase max substeps for more reliable physics at varying framerates
    if (!maxSubSteps) maxSubSteps = 5;
    this.world.step(fixedTimeStep, delta, maxSubSteps);
  }
}
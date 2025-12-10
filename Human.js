// Human.js - Rigged low-poly human with animation
export class Human {
  constructor(scene, world, position) {
    this.scene = scene;
    this.world = world;
    this.walkSpeed = 1.0 + Math.random() * 0.5;
    
    // Create Mesh Hierarchy
    this.mesh = new THREE.Group();
    this.mesh.position.copy(position);
    this.mesh.userData.itemName = "Citizen"; // For pickup
    
    // Materials
    const skinColor = 0xffccaa;
    const skinMat = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.8 });
    const shirtColor = new THREE.Color().setHSL(Math.random(), 0.7, 0.5);
    const shirtMat = new THREE.MeshStandardMaterial({ color: shirtColor, roughness: 0.9 });
    const pantsColor = new THREE.Color().setHSL(Math.random(), 0.5, 0.3);
    const pantsMat = new THREE.MeshStandardMaterial({ color: pantsColor, roughness: 0.9 });
    
    // Scale: Small enough to be picked up, but visible
    const s = 0.4; 
    this.mesh.scale.set(s, s, s);
    
    // 1. Torso
    const torsoGeo = new THREE.BoxGeometry(1, 1.2, 0.5);
    this.torso = new THREE.Mesh(torsoGeo, shirtMat);
    this.torso.position.y = 2.4; // Hip height approx
    this.torso.castShadow = true;
    this.torso.receiveShadow = true;
    this.mesh.add(this.torso);
    
    // 2. Head
    const headGeo = new THREE.BoxGeometry(0.7, 0.8, 0.7);
    this.head = new THREE.Mesh(headGeo, skinMat);
    this.head.position.y = 1.1; // On top of torso
    this.torso.add(this.head);
    
    // Helper to create limb with pivot
    const createLimb = (w, h, d, mat, x, y, z) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.y = -h / 2; // Offset so pivot is at top
      mesh.castShadow = true;
      
      const pivot = new THREE.Group();
      pivot.position.set(x, y, z);
      pivot.add(mesh);
      return pivot;
    };
    
    // 3. Arms
    this.armL = createLimb(0.3, 1.0, 0.3, shirtMat, 0.65, 0.5, 0);
    this.torso.add(this.armL);
    
    this.armR = createLimb(0.3, 1.0, 0.3, shirtMat, -0.65, 0.5, 0);
    this.torso.add(this.armR);
    
    // 4. Legs
    this.legL = createLimb(0.35, 1.2, 0.35, pantsMat, 0.3, -0.6, 0);
    this.torso.add(this.legL);
    
    this.legR = createLimb(0.35, 1.2, 0.35, pantsMat, -0.3, -0.6, 0);
    this.torso.add(this.legR);
    
    this.scene.add(this.mesh);
    
    // Physics Body (Capsule-like)
    // Using a cylinder for stability
    const shape = new CANNON.Cylinder(0.3 * s, 0.3 * s, 3 * s, 8);
    // Rotate cylinder to align with Y axis in Cannon
    const q = new CANNON.Quaternion();
    q.setFromAxisAngle(new CANNON.Vec3(1,0,0), -Math.PI/2);
    
    this.body = new CANNON.Body({
      mass: 5, 
      shape: shape,
      position: new CANNON.Vec3(position.x, 1.5 * s, position.z),
      fixedRotation: true,
      linearDamping: 0.5
    });
    this.body.quaternion.set(q.x, q.y, q.z, q.w);
    
    this.world.addBody(this.body);
    
    // Movement state
    this.moveDir = new THREE.Vector3(Math.random()-0.5, 0, Math.random()-0.5).normalize();
    this.changeDirTimer = 0;
  }
  
  update(time, delta) {
    if (!this.body || !this.mesh || !this.body.world) return;
    
    // AI: Random walk
    this.changeDirTimer -= delta;
    if (this.changeDirTimer <= 0) {
      this.moveDir.set(Math.random()-0.5, 0, Math.random()-0.5).normalize();
      this.changeDirTimer = 2 + Math.random() * 4;
    }
    
    // Move body
    const speed = 2.0;
    this.body.velocity.x = this.moveDir.x * speed;
    this.body.velocity.z = this.moveDir.z * speed;
    
    // Sync mesh position
    this.mesh.position.copy(this.body.position);
    this.mesh.position.y -= 0.6; // Adjust visual offset to match physics collider
    
    // Rotate mesh to face movement
    const targetRotation = Math.atan2(this.moveDir.x, this.moveDir.z);
    // Smooth rotation
    const currentRotation = this.mesh.rotation.y;
    let diff = targetRotation - currentRotation;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.mesh.rotation.y += diff * delta * 5;
    
    // Animate Limbs
    const f = time * 10 * this.walkSpeed;
    this.legL.rotation.x = Math.sin(f) * 0.5;
    this.legR.rotation.x = Math.sin(f + Math.PI) * 0.5;
    this.armL.rotation.x = Math.sin(f + Math.PI) * 0.3;
    this.armR.rotation.x = Math.sin(f) * 0.3;
  }
}
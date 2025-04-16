export class FlyingCreature {
  constructor(scene, type, startPosition) {
    this.scene = scene;
    this.type = type;
    this.startPosition = startPosition.clone();
    this.object = new THREE.Group();
    this.createGeometry();
    this.scene.add(this.object);
    this.timeOffset = Math.random() * Math.PI * 2;
  }

  createGeometry() {
    if(this.type === 'butterfly') {
      // Butterfly: small body and two wings
      const bodyGeometry = new THREE.SphereGeometry(0.1, 8, 8);
      const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      this.object.add(body);

      const wingGeometry = new THREE.PlaneGeometry(0.3, 0.2);
      const wingMaterial = new THREE.MeshBasicMaterial({ color: 0xffaaff, side: THREE.DoubleSide });
      const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
      leftWing.position.set(-0.15, 0, 0);
      leftWing.rotation.y = Math.PI / 4;
      const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
      rightWing.position.set(0.15, 0, 0);
      rightWing.rotation.y = -Math.PI / 4;

      this.object.add(leftWing);
      this.object.add(rightWing);
    } else if (this.type === 'eagle') {
      // Eagle: larger bird, a box body with spread wings
      const bodyGeometry = new THREE.BoxGeometry(0.3, 0.15, 0.6);
      const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      this.object.add(body);
      
      const wingGeometry = new THREE.PlaneGeometry(0.5, 0.3);
      const wingMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513, side: THREE.DoubleSide });
      const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
      leftWing.position.set(-0.25, 0, -0.1);
      leftWing.rotation.set(0, 0, Math.PI / 6);
      const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
      rightWing.position.set(0.25, 0, -0.1);
      rightWing.rotation.set(0, 0, -Math.PI / 6);

      this.object.add(leftWing);
      this.object.add(rightWing);
    } else if (this.type === 'bee') {
      // Bee: small insect with yellow body and a stripe
      const bodyGeometry = new THREE.CylinderGeometry(0.1, 0.1, 0.3, 8);
      const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0xffff00 });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      this.object.add(body);

      const stripeGeometry = new THREE.BoxGeometry(0.12, 0.3, 0.01);
      const stripeMaterial = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const stripe = new THREE.Mesh(stripeGeometry, stripeMaterial);
      stripe.position.set(0, 0, 0.15);
      this.object.add(stripe);
    } else if (this.type === 'bird') {
      // Generic bird
      const bodyGeometry = new THREE.CylinderGeometry(0.1, 0.15, 0.4, 8);
      const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0xA52A2A });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.rotation.set(Math.PI/2, 0, 0);
      this.object.add(body);
      
      const wingGeometry = new THREE.PlaneGeometry(0.4, 0.2);
      const wingMaterial = new THREE.MeshBasicMaterial({ color: 0xA52A2A, side: THREE.DoubleSide });
      const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
      leftWing.position.set(-0.2, 0, 0);
      const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
      rightWing.position.set(0.2, 0, 0);
      
      this.object.add(leftWing);
      this.object.add(rightWing);
    } else if (this.type === 'vulture') {
      // Vulture: large bird with broad wings
      const bodyGeometry = new THREE.CylinderGeometry(0.15, 0.2, 0.6, 8);
      const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.rotation.set(Math.PI/2, 0, 0);
      this.object.add(body);
      
      const wingGeometry = new THREE.PlaneGeometry(0.8, 0.3);
      const wingMaterial = new THREE.MeshBasicMaterial({ color: 0x333333, side: THREE.DoubleSide });
      const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
      leftWing.position.set(-0.4, 0, 0);
      const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
      rightWing.position.set(0.4, 0, 0);
      
      this.object.add(leftWing);
      this.object.add(rightWing);
    } else if (this.type === 'dragonfly') {
      // Dragonfly: long body with two sets of thin wings
      const bodyGeometry = new THREE.CylinderGeometry(0.05, 0.05, 0.5, 8);
      const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x00FFFF });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.rotation.set(Math.PI/2, 0, 0);
      this.object.add(body);
      
      const wingGeometry = new THREE.PlaneGeometry(0.3, 0.1);
      const wingMaterial = new THREE.MeshBasicMaterial({ 
        color: 0xFFFFFF, 
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.7
      });
      
      // Front wings
      const frontLeftWing = new THREE.Mesh(wingGeometry, wingMaterial);
      frontLeftWing.position.set(-0.15, 0, -0.1);
      frontLeftWing.rotation.set(0, 0.5, Math.PI/6);
      this.object.add(frontLeftWing);
      
      const frontRightWing = new THREE.Mesh(wingGeometry, wingMaterial);
      frontRightWing.position.set(0.15, 0, -0.1);
      frontRightWing.rotation.set(0, -0.5, -Math.PI/6);
      this.object.add(frontRightWing);
      
      // Back wings
      const backLeftWing = new THREE.Mesh(wingGeometry, wingMaterial);
      backLeftWing.position.set(-0.15, 0, 0.1);
      backLeftWing.rotation.set(0, 0.5, Math.PI/4);
      this.object.add(backLeftWing);
      
      const backRightWing = new THREE.Mesh(wingGeometry, wingMaterial);
      backRightWing.position.set(0.15, 0, 0.1);
      backRightWing.rotation.set(0, -0.5, -Math.PI/4);
      this.object.add(backRightWing);
    } else if (this.type === 'hawk') {
      // Hawk: streamlined bird with pointed wings
      const bodyGeometry = new THREE.CylinderGeometry(0.12, 0.18, 0.5, 8);
      const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.rotation.set(Math.PI/2, 0, 0);
      this.object.add(body);
      
      const wingGeometry = new THREE.BufferGeometry();
      // Triangle-shaped wings
      const vertices = new Float32Array([
        0, 0, 0,         // center
        -0.6, 0, -0.2,   // front
        -0.5, 0, 0.2     // back
      ]);
      const indices = [0, 1, 2];
      wingGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
      wingGeometry.setIndex(indices);
      wingGeometry.computeVertexNormals();
      
      const wingMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513, side: THREE.DoubleSide });
      const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
      
      const rightWingGeom = wingGeometry.clone();
      // Flip the right wing
      const rightVertices = rightWingGeom.attributes.position.array;
      for (let i = 0; i < rightVertices.length; i += 3) {
        rightVertices[i] = -rightVertices[i]; // Flip x-coordinate
      }
      const rightWing = new THREE.Mesh(rightWingGeom, wingMaterial);
      
      this.object.add(leftWing);
      this.object.add(rightWing);
    } else if (this.type === 'bat') {
      // Bat: small body with membrane wings
      const bodyGeometry = new THREE.SphereGeometry(0.1, 8, 8);
      const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x333333 });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      this.object.add(body);
      
      // Create membrane wings
      const wingShape = new THREE.Shape();
      wingShape.moveTo(0, 0); // Start at body
      wingShape.quadraticCurveTo(-0.1, -0.05, -0.2, -0.05); // First bend
      wingShape.quadraticCurveTo(-0.3, -0.1, -0.4, 0);      // Wing tip
      wingShape.quadraticCurveTo(-0.3, 0.1, -0.2, 0.1);     // Back bend
      wingShape.quadraticCurveTo(-0.1, 0.05, 0, 0);         // Back to body
      
      const wingGeometry = new THREE.ShapeGeometry(wingShape);
      const wingMaterial = new THREE.MeshBasicMaterial({ 
        color: 0x555555, 
        side: THREE.DoubleSide 
      });
      
      const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
      
      // Clone and flip for right wing
      const rightWing = leftWing.clone();
      rightWing.scale.x = -1; // Mirror along x-axis
      
      this.object.add(leftWing);
      this.object.add(rightWing);
    } else if (this.type === 'snowbird') {
      // White bird for snow biomes
      const bodyGeometry = new THREE.CylinderGeometry(0.1, 0.15, 0.4, 8);
      const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.rotation.set(Math.PI/2, 0, 0);
      this.object.add(body);
      
      const wingGeometry = new THREE.PlaneGeometry(0.4, 0.2);
      const wingMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, side: THREE.DoubleSide });
      const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
      leftWing.position.set(-0.2, 0, 0);
      const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
      rightWing.position.set(0.2, 0, 0);
      
      this.object.add(leftWing);
      this.object.add(rightWing);
    } else if (this.type === 'owl') {
      // Owl with round head and body
      const bodyGeometry = new THREE.SphereGeometry(0.15, 8, 8);
      const bodyMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513 });
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      this.object.add(body);
      
      const headGeometry = new THREE.SphereGeometry(0.12, 8, 8);
      const headMaterial = new THREE.MeshBasicMaterial({ color: 0xA52A2A });
      const head = new THREE.Mesh(headGeometry, headMaterial);
      head.position.z = -0.2;
      head.position.y = 0.05;
      this.object.add(head);
      
      // Eyes
      const eyeGeometry = new THREE.SphereGeometry(0.03, 8, 8);
      const eyeMaterial = new THREE.MeshBasicMaterial({ color: 0xFFFF00 });
      const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      leftEye.position.set(-0.06, 0.08, -0.28);
      this.object.add(leftEye);
      
      const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      rightEye.position.set(0.06, 0.08, -0.28);
      this.object.add(rightEye);
      
      // Wings
      const wingGeometry = new THREE.PlaneGeometry(0.3, 0.2);
      const wingMaterial = new THREE.MeshBasicMaterial({ color: 0x8B4513, side: THREE.DoubleSide });
      const leftWing = new THREE.Mesh(wingGeometry, wingMaterial);
      leftWing.position.set(-0.18, 0, 0);
      const rightWing = new THREE.Mesh(wingGeometry, wingMaterial);
      rightWing.position.set(0.18, 0, 0);
      
      this.object.add(leftWing);
      this.object.add(rightWing);
    }
    // Set initial position
    this.object.position.copy(this.startPosition);
  }

  update(time) {
    // Animate the flying creature with a gentle oscillation and circular lateral movement.
    const amplitude = 2;
    const frequency = 0.5;
    const offsetY = Math.sin(time * frequency + this.timeOffset) * amplitude;
    const offsetX = Math.cos(time * frequency + this.timeOffset) * 1;
    this.object.position.x = this.startPosition.x + offsetX;
    this.object.position.y = this.startPosition.y + offsetY;
    // Slowly rotate the creature to simulate natural movement.
    this.object.rotation.y += 0.01;
    
    // Add wing flapping animation based on creature type
    if (this.type === 'butterfly' || this.type === 'bee' || this.type === 'dragonfly') {
      // Fast wing flapping for insects
      const wingSpeed = 20;
      const wingAngle = Math.sin(time * wingSpeed) * 0.5;
      
      if (this.object.children.length >= 3) {
        const leftWing = this.object.children[1];
        const rightWing = this.object.children[2];
        
        if (leftWing && rightWing) {
          leftWing.rotation.y = Math.PI / 4 - wingAngle;
          rightWing.rotation.y = -Math.PI / 4 + wingAngle;
        }
      }
    } else if (this.type !== 'bat') {
      // Slower wing flapping for birds
      const wingSpeed = 8;
      const wingAngle = Math.sin(time * wingSpeed) * 0.3;
      
      if (this.object.children.length >= 3) {
        const leftWing = this.object.children[1];
        const rightWing = this.object.children[2];
        
        if (leftWing && rightWing) {
          leftWing.rotation.z = wingAngle;
          rightWing.rotation.z = -wingAngle;
        }
      }
    } else {
      // Bat wing flapping
      const wingSpeed = 10;
      const wingAngle = Math.abs(Math.sin(time * wingSpeed)) * 0.5;
      
      if (this.object.children.length >= 3) {
        const leftWing = this.object.children[1];
        const rightWing = this.object.children[2];
        
        if (leftWing && rightWing) {
          leftWing.rotation.z = wingAngle;
          rightWing.rotation.z = wingAngle;
        }
      }
    }
  }

  dispose() {
    this.scene.remove(this.object);
    this.object.traverse(child => {
      if(child.geometry) child.geometry.dispose();
      if(child.material) {
        if(Array.isArray(child.material))
          child.material.forEach(mat => mat.dispose());
        else
          child.material.dispose();
      }
    });
  }
}
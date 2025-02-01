import { CityGenerator } from './cityGenerator.js';
import { PlayerBall } from './playerBall.js';
import { PickupPreview } from './pickupPreview.js';
import { Minimap } from './minimap.js';

class Game {
  constructor() {
    // Game state: "TITLE" for demo mode, "PLAY" for actual gameplay
    this.gameState = "TITLE";

    // Setup camera
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    // Initial camera position for title screen demo
    this.camera.position.set(0, 20, 40);

    this.setupScene();
    this.setupPhysics();
    this.setupLights();

    // Create the city and player
    // Spawn player near origin so that all players are close together
    this.cityGenerator = new CityGenerator(this.scene, this.world);
    this.player = new PlayerBall(this.scene, this.world);
    // Ensure initial player position is near the center.
    this.player.body.position.set(0, this.player.radius, 0);
    this.player.mesh.position.copy(this.player.body.position);
    // Initialize additional properties for player collisions
    this.player.isStuck = false;
    this.player.stuckTo = null;

    // Add ground
    this.addGround();

    this.setupControls();
    this.setupCollisions();

    // Joystick input tracking
    this.joystickMovements = [];

    // Load the audio file
    this.audio = new Audio('Electric Dreamers - Track 2 - Sonauto (2).wav');
    this.audio.loop = true;
    this.audioPlayed = false;

    window.addEventListener(
      'pointerdown',
      () => {
        if (!this.audioPlayed) {
          this.audio.play();
          this.audioPlayed = true;
        }
      },
      { once: true }
    );

    // Optimization: detect device memory and set optimal pixel ratio
    const deviceMemory = navigator.deviceMemory || 4;
    const optimalPixelRatio = deviceMemory <= 2 ? 1 : Math.min(window.devicePixelRatio, 2);
    this.deviceMemory = deviceMemory;
    this.renderer.setPixelRatio(optimalPixelRatio);

    // Shadows disabled for performance
    this.renderer.shadowMap.enabled = false;
    
    this._playerPos = new THREE.Vector3();
    this._temp = new THREE.Vector3();
    
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Initialize the pickup preview UI
    this.pickupPreview = new PickupPreview();

    // Initialize the minimap
    this.minimap = new Minimap();

    // Demo mode variables for title screen
    this.demoTimer = 0;
    this.demoDirection = new THREE.Vector2(0, 0);
    this.demoOrbitAngle = 0;

    // Initialize Multiplayer Lobby
    // Create a WebsimSocket room connection (assumed to be available globally)
    this.room = new WebsimSocket();
    // Dictionary for remote players' 3D representations
    this.peerPlayers = {};  
    // New: Dictionary for remote players' physics bodies for proper collision simulation.
    this.peerBodies = {};
    this.lastSentPosition = 0;
    this.setupMultiplayer();

    // Setup Title Screen input listener
    const titleScreenEl = document.getElementById('title-screen');
    titleScreenEl.addEventListener('pointerdown', () => {
      // Transition to play mode: hide the title screen overlay
      titleScreenEl.style.display = 'none';
      this.gameState = "PLAY";
      // Optionally reset camera to follow player normally:
      this.camera.position.set(0, 10 + this.player.radius * 2, 20 + this.player.radius * 3);
      this.camera.lookAt(this.player.mesh.position);
    }, { once: true });

    this.start();
  }

  setupMultiplayer() {
    // Handle incoming messages for peer ball updates, disconnections, and pickup removals
    this.room.onmessage = (event) => {
      const data = event.data;
      switch (data.type) {
        // When receiving ball updates, we create/update a remote physics body
        case "ball-update":
          // Ignore our own ball updates
          if (data.clientId === this.room.party.client.id) return;
          
          // If we haven't seen this peer yet, create a detailed ball representation along with a physics body.
          if (!this.peerPlayers[data.clientId]) {
            const group = new THREE.Group();
            // Create main ball mesh reflecting radius
            const geometry = new THREE.SphereGeometry(data.radius, 32, 32);
            const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
            const ballMesh = new THREE.Mesh(geometry, material);
            ballMesh.castShadow = true;
            group.add(ballMesh);
            group.userData.mainBallMesh = ballMesh;
            // Add attachments as simple spheres (will be updated below)
            if (data.attachedData) {
              data.attachedData.forEach(attachment => {
                let attGeom;
                if (attachment.geometryType === 'SphereGeometry') {
                  attGeom = new THREE.SphereGeometry(0.1, 8, 8);
                } else if (attachment.geometryType === 'BoxGeometry') {
                  attGeom = new THREE.BoxGeometry(0.2, 0.2, 0.2);
                } else if (attachment.geometryType === 'CylinderGeometry') {
                  attGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8);
                } else {
                  attGeom = new THREE.SphereGeometry(0.1, 8, 8);
                }
                const attMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const attMesh = new THREE.Mesh(attGeom, attMat);
                attMesh.position.set(
                  attachment.direction.x * data.radius,
                  attachment.direction.y * data.radius,
                  attachment.direction.z * data.radius
                );
                group.add(attMesh);
              });
            }
            this.scene.add(group);
            this.peerPlayers[data.clientId] = group;
            
            // Create a Cannon physics body for this remote player so that collisions work.
            const mass = data.radius * 2; // Simplified mass estimation.
            const shape = new CANNON.Sphere(data.radius);
            const body = new CANNON.Body({
              mass: mass,
              shape: shape,
              position: new CANNON.Vec3(data.position.x, data.position.y, data.position.z)
            });
            // Initialize with received quaternion.
            body.quaternion.set(data.quaternion.x, data.quaternion.y, data.quaternion.z, data.quaternion.w);
            this.world.addBody(body);
            this.peerBodies[data.clientId] = body;
          } else {
            // Update existing peer ball (both 3D group and physics body)
            const group = this.peerPlayers[data.clientId];
            const body = this.peerBodies[data.clientId];
            const targetPos = new CANNON.Vec3(data.position.x, data.position.y, data.position.z);
            // Compute velocity update based on difference (assuming network updates roughly every 100ms)
            const velocityFactor = 10; // 1/0.1 sec approximation
            const deltaPos = targetPos.vsub(body.position);
            body.velocity.set(
              deltaPos.x * velocityFactor,
              deltaPos.y * velocityFactor,
              deltaPos.z * velocityFactor
            );
            // Smoothly update rotation as well.
            body.quaternion.set(data.quaternion.x, data.quaternion.y, data.quaternion.z, data.quaternion.w);
            
            // If radius has changed, update collision shape and the main mesh geometry.
            if (body.shapes[0].radius !== data.radius) {
              // Remove old shape and add new shape with updated radius.
              body.shapes = [];
              const newShape = new CANNON.Sphere(data.radius);
              body.addShape(newShape);
              // Update mass proportionally (approximation)
              body.mass = data.radius * 2;
              body.updateMassProperties();
              
              // Update main ball mesh geometry.
              const mainBallMesh = group.userData.mainBallMesh;
              mainBallMesh.geometry.dispose();
              mainBallMesh.geometry = new THREE.SphereGeometry(data.radius, 32, 32);
            }
            
            // Update attachments: remove existing attachments except the main ball mesh.
            while (group.children.length > 1) {
              const child = group.children[1];
              group.remove(child);
              if (child.geometry) child.geometry.dispose();
              if (child.material) child.material.dispose();
            }
            if (data.attachedData) {
              data.attachedData.forEach(attachment => {
                let attGeom;
                if (attachment.geometryType === 'SphereGeometry') {
                  attGeom = new THREE.SphereGeometry(0.1, 8, 8);
                } else if (attachment.geometryType === 'BoxGeometry') {
                  attGeom = new THREE.BoxGeometry(0.2, 0.2, 0.2);
                } else if (attachment.geometryType === 'CylinderGeometry') {
                  attGeom = new THREE.CylinderGeometry(0.1, 0.1, 0.2, 8);
                } else {
                  attGeom = new THREE.SphereGeometry(0.1, 8, 8);
                }
                const attMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const attMesh = new THREE.Mesh(attGeom, attMat);
                attMesh.position.set(
                  attachment.direction.x * data.radius,
                  attachment.direction.y * data.radius,
                  attachment.direction.z * data.radius
                );
                group.add(attMesh);
              });
            }
          }
          break;
        case "disconnected":
          // Remove disconnected player's mesh and physics body if they exist.
          if (this.peerPlayers[data.clientId]) {
            this.scene.remove(this.peerPlayers[data.clientId]);
            delete this.peerPlayers[data.clientId];
          }
          if (this.peerBodies[data.clientId]) {
            this.world.removeBody(this.peerBodies[data.clientId]);
            delete this.peerBodies[data.clientId];
          }
          break;
        case "object-picked-up":
          // When a peer picks up an object, remove that object from our city as well.
          // This ensures all peers see the same map data.
          this.cityGenerator.removeObjectByBodyId(data.bodyId);
          break;
        default:
          // Handle other event types if needed
          break;
      }
    };
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('gameCanvas'),
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  setupPhysics() {
    this.world = new CANNON.World();
    // Strengthen gravity for realism
    this.world.gravity.set(0, -40, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 10;
    this.world.defaultContactMaterial.friction = 0.5;
    this.world.defaultContactMaterial.restitution = 0.3;
  }

  setupLights() {
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    this.scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 20, 10);
    this.scene.add(directionalLight);
  }

  addGround() {
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x999999 });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    this.scene.add(groundMesh);

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
  }

  setupControls() {
    // Setup joystick controls for mobile and keyboard for desktop ONLY in PLAY mode.
    this.joystick = nipplejs.create({
      zone: document.getElementById('joystick-area'),
      mode: 'static',
      position: { left: '60px', bottom: '60px' },
      color: 'white'
    });

    this.joystick.on('move', (evt, data) => {
      // Only process input if in PLAY mode
      if (this.gameState !== "PLAY") return;
      
      // Count joystick wiggles regardless of stuck state.
      const maxForce = 5;
      const force = {
        x: data.vector.x * maxForce,
        y: -data.vector.y * maxForce
      };

      const currentTime = performance.now();
      const directionY = data.vector.y;

      if (Math.abs(directionY) > 0.5) {
        this.joystickMovements.push({ time: currentTime, directionY: directionY });
      }

      this.joystickMovements = this.joystickMovements.filter(m => currentTime - m.time < 500);

      let signChanges = 0;
      for (let i = 1; i < this.joystickMovements.length; i++) {
        if ((this.joystickMovements[i].directionY > 0 && this.joystickMovements[i - 1].directionY <= 0) ||
            (this.joystickMovements[i].directionY <= 0 && this.joystickMovements[i - 1].directionY > 0)) {
          signChanges++;
        }
      }
      
      // If player is stuck to a larger player, require rapid wiggle to get unstuck.
      if (this.player.isStuck) {
        if (signChanges >= 3) {
          // Unstick the player and apply a freeing force.
          this.player.isStuck = false;
          this.player.stuckTo = null;
          this.player.applyForce(force);
        }
        return;
      }

      this.player.applyForce(force);
      if (signChanges >= 3) {
        // Longer boost duration with 5x acceleration during boost
        this.player.triggerBoost(5000);
      }
    });

    this.joystick.on('end', () => {
      this.player.setBoosting(false);
    });

    this.keys = {};
    this.keyboardMovements = [];

    window.addEventListener('keydown', (e) => {
      if (this.gameState !== "PLAY") return;
      this.keys[e.key] = true;
      this.updateKeyboardControls();
    });

    window.addEventListener('keyup', (e) => {
      if (this.gameState !== "PLAY") return;
      this.keys[e.key] = false;
      this.updateKeyboardControls();
    });
  }

  updateKeyboardControls() {
    const force = { x: 0, y: 0 };
    const speed = 10;
    let isMoving = false;

    if (this.keys['ArrowUp'] || this.keys['w']) {
      force.y = -speed;
      isMoving = true;
    }
    if (this.keys['ArrowDown'] || this.keys['s']) {
      force.y = speed;
      isMoving = true;
    }
    if (this.keys['ArrowLeft'] || this.keys['a']) {
      force.x = -speed;
      isMoving = true;
    }
    if (this.keys['ArrowRight'] || this.keys['d']) {
      force.x = speed;
      isMoving = true;
    }

    const currentTime = performance.now();
    const directionY = force.y;

    if (isMoving && Math.abs(directionY) > 0.5) {
      this.keyboardMovements.push({ time: currentTime, directionY: directionY });
    }

    this.keyboardMovements = this.keyboardMovements.filter(m => currentTime - m.time < 500);

    let signChanges = 0;
    for (let i = 1; i < this.keyboardMovements.length; i++) {
      if ((this.keyboardMovements[i].directionY > 0 && this.keyboardMovements[i - 1].directionY <= 0) ||
          (this.keyboardMovements[i].directionY <= 0 && this.keyboardMovements[i - 1].directionY > 0)) {
        signChanges++;
      }
    }
    
    // If player is stuck to a larger player, require rapid wiggle to get unstuck.
    if (this.player.isStuck) {
      if (signChanges >= 3) {
        // Unstick the player and apply the current force.
        this.player.isStuck = false;
        this.player.stuckTo = null;
        this.player.applyForce(force);
      }
      return;
    }

    if (isMoving) {
      this.player.applyForce(force);
      if (signChanges >= 3) {
        this.player.triggerBoost(5000);
      }
    } else {
      this.player.setBoosting(false);
    }
  }

  setupCollisions() {
    this.player.body.addEventListener('collide', (event) => {
      const otherBody = event.body;

      if (otherBody.mass === 0) return;

      // Only check ground objects for collision with the player.
      const groundObjects = [];
      this.cityGenerator.objects.forEach(chunkData => {
        groundObjects.push(...chunkData.ground);
      });
      const object = groundObjects.find((obj) => obj.body === otherBody);

      if (object) {
        const objectSize =
          object.body.shapes[0].radius ||
          Math.max(
            object.body.shapes[0].halfExtents.x,
            object.body.shapes[0].halfExtents.y,
            object.body.shapes[0].halfExtents.z
          );

        if (objectSize < this.player.radius) {
          // Update the pickup preview UI before absorbing the object
          const previewClone = object.mesh.clone();
          const itemName = object.mesh.userData.itemName || "Collectible";
          this.pickupPreview.update(previewClone, itemName);

          this.player.absorbObject(object);

          // Remove object from the chunk's ground objects array
          this.cityGenerator.objects.forEach(chunkData => {
            const index = chunkData.ground.findIndex((obj) => obj.body === otherBody);
            if (index !== -1) {
              chunkData.ground.splice(index, 1);
            }
          });

          document.getElementById('size-value').textContent =
            this.player.getSize().toFixed(1);
          document.getElementById('score-value').textContent =
            this.player.getCollectedCount();

          // Persist the pickup to the database so that it appears in the live multiplayer lobby
          (async () => {
            try {
              await this.room.collection('pickup').create({
                objectName: itemName,
                playerId: this.room.party.client.id,
                size: this.player.getSize()
              });
            } catch (error) {
              console.error('Error saving pickup record:', error);
            }
          })();

          // Notify all peers to remove this object from their scenes
          this.room.send({
            type: "object-picked-up",
            bodyId: object.body.id
          });
        }
      }
    });
  }

  // Check collisions between local player and remote players (peerPlayers)
  checkPlayerCollisions() {
    const localPos = this.player.mesh.position;
    const localRadius = this.player.radius;
    for (const clientId in this.peerPlayers) {
      const group = this.peerPlayers[clientId];
      // Get remote player's radius from its main ball mesh
      const peerRadius = group.userData.mainBallMesh.geometry.parameters.radius;
      const distance = localPos.distanceTo(group.position);
      if (distance < localRadius + peerRadius) {
        // If the local player is at least 5m larger, absorb the remote player.
        if (localRadius >= peerRadius + 5) {
          this.absorbPeer(clientId, peerRadius);
        }
        // Otherwise, if the remote player is at least 5m larger, mark local player as stuck.
        else if (peerRadius >= localRadius + 5) {
          if (!this.player.isStuck) {
            this.player.isStuck = true;
            this.player.stuckTo = clientId;
            // Optionally, you could provide a visual indicator here.
          }
        }
      } else {
        // If previously stuck to this peer and no longer colliding, clear stuck state.
        if (this.player.isStuck && this.player.stuckTo === clientId) {
          this.player.isStuck = false;
          this.player.stuckTo = null;
        }
      }
    }
  }

  // Absorb a remote player peer by updating the local player's radius, mass, and geometry.
  absorbPeer(clientId, peerRadius) {
    // Remove peer's mesh from scene and from peerPlayers and physics world.
    const peerGroup = this.peerPlayers[clientId];
    if (peerGroup) {
      this.scene.remove(peerGroup);
      delete this.peerPlayers[clientId];
    }
    if (this.peerBodies[clientId]) {
      this.world.removeBody(this.peerBodies[clientId]);
      delete this.peerBodies[clientId];
    }
    // Compute volumes for both balls
    const localVolume = (4 / 3) * Math.PI * Math.pow(this.player.radius, 3);
    const peerVolume = (4 / 3) * Math.PI * Math.pow(peerRadius, 3);
    const newVolume = localVolume + peerVolume;
    const newRadius = Math.cbrt((3 * newVolume) / (4 * Math.PI));

    // Update player's radius
    const oldRadius = this.player.radius;
    this.player.radius = newRadius;
    // Update the main collision shape
    this.player.body.shapes[0].radius = newRadius;
    // Update mass proportionally (approximation)
    const newMass = this.player.body.mass * (newVolume / localVolume);
    this.player.body.mass = newMass;
    this.player.body.updateMassProperties();

    // Update the player's mesh geometry
    const newGeometry = new THREE.SphereGeometry(newRadius, 32, 32);
    this.player.mesh.geometry.dispose();
    this.player.mesh.geometry = newGeometry;

    // Update attached meshes positions
    this.player.attachedMeshes.forEach(attached => {
      const newPos = attached.direction.clone().multiplyScalar(newRadius);
      attached.mesh.position.copy(newPos);
    });

    // Update UI for size
    document.getElementById('size-value').textContent = newRadius.toFixed(1);
  }

  updateCamera(delta) {
    if (this.gameState === "TITLE") {
      // In demo mode, slowly orbit around the player for an attractive pan effect
      this.demoOrbitAngle += delta * 0.1;
      const orbitRadius = 40;
      const playerPos = this.player.mesh.position;
      this.camera.position.set(
        playerPos.x + orbitRadius * Math.cos(this.demoOrbitAngle),
        playerPos.y + 20,
        playerPos.z + orbitRadius * Math.sin(this.demoOrbitAngle)
      );
      this.camera.lookAt(playerPos);
    } else {
      // In play mode, follow the player with an offset
      const playerPos = this.player.mesh.position;
      const cameraOffset = new THREE.Vector3(
        0,
        10 + this.player.radius * 2,
        20 + this.player.radius * 3
      );
      this.camera.position.copy(playerPos).add(cameraOffset);
      this.camera.lookAt(playerPos);
    }
  }

  start() {
    const animate = () => {
      requestAnimationFrame(animate);

      const delta = this.clock.getDelta();
      this.world.step(this.fixedTimeStep, delta, this.maxSubSteps);
      
      // In demo mode, automatically apply a random force to the ball.
      if (this.gameState === "TITLE") {
        this.demoTimer += delta;
        if (this.demoTimer >= 2) {
          // Choose a new random direction every 2 seconds
          this.demoDirection.set(Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
          this.demoTimer = 0;
        }
        this.player.applyForce({ x: this.demoDirection.x * 5, y: this.demoDirection.y * 5 });
      }

      this.player.update();
      // Check collisions between local player and remote players
      this.checkPlayerCollisions();
      this.updateCamera(delta);
      
      // Update city chunks every other frame
      if (this.frame % 2 === 0) {
        this.cityGenerator.update(this.player.body.position);
      }
      
      // Update flying creatures for all loaded chunks
      const currentTime = performance.now() / 1000;
      this.cityGenerator.objects.forEach(chunkData => {
        chunkData.flying.forEach(creature => {
          creature.update(currentTime);
        });
      });

      // Send our current ball state (position, orientation, size, attachments) to other peers (throttled every 100ms)
      if (performance.now() - this.lastSentPosition > 100) {
        this.room.send({
          type: "ball-update",
          position: { 
            x: this.player.mesh.position.x, 
            y: this.player.mesh.position.y, 
            z: this.player.mesh.position.z 
          },
          quaternion: { 
            x: this.player.mesh.quaternion.x, 
            y: this.player.mesh.quaternion.y, 
            z: this.player.mesh.quaternion.z, 
            w: this.player.mesh.quaternion.w 
          },
          radius: this.player.radius,
          attachedData: this.player.attachedMeshes.map(att => ({
            direction: { x: att.direction.x, y: att.direction.y, z: att.direction.z },
            geometryType: att.mesh.geometry.type,
            itemName: att.mesh.userData.itemName || ""
          })),
          isDemo: this.gameState === "TITLE"
        });
        this.lastSentPosition = performance.now();
      }

      // Update remote peer 3D groups from their physics bodies for collision accuracy.
      for (const clientId in this.peerBodies) {
        const body = this.peerBodies[clientId];
        const group = this.peerPlayers[clientId];
        if (group && body) {
          group.position.copy(body.position);
          group.quaternion.copy(body.quaternion);
        }
      }

      // Update the minimap with local player and peer positions
      this.minimap.update(this.player, this.peerPlayers);

      this.renderer.render(this.scene, this.camera);
      this.frame++;
    };

    this.frame = 0;
    this.clock = new THREE.Clock();
    this.fixedTimeStep = 1.0 / 60.0;
    this.maxSubSteps = 3;
    animate();
  }
}

new Game();
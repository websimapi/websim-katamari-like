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

    // Remove Glow effect: No bloom or composer is used anymore

    this.clock = new THREE.Clock();
    this.fixedTimeStep = 1.0 / 60.0;
    this.maxSubSteps = 3;

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
    this.peerPlayers = {};  // To keep track of other players in the lobby
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
    // Handle incoming messages for peer position updates and disconnections
    this.room.onmessage = (event) => {
      const data = event.data;
      switch (data.type) {
        case "position-update":
          // Ignore our own position updates
          if (data.clientId === this.room.party.client.id) return;
          // If we haven't seen this peer yet, create a simple representation
          if (!this.peerPlayers[data.clientId]) {
            const geometry = new THREE.SphereGeometry(1, 16, 16);
            const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            const peerMesh = new THREE.Mesh(geometry, material);
            peerMesh.castShadow = true;
            this.scene.add(peerMesh);
            this.peerPlayers[data.clientId] = peerMesh;
          }
          // Update the peer's position
          this.peerPlayers[data.clientId].position.set(
            data.position.x,
            data.position.y,
            data.position.z
          );
          break;
        case "disconnected":
          // Remove disconnected player's mesh if it exists
          if (this.peerPlayers[data.clientId]) {
            this.scene.remove(this.peerPlayers[data.clientId]);
            delete this.peerPlayers[data.clientId];
          }
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

      let boost = false;
      if (signChanges >= 3) {
        boost = true;
        this.joystickMovements = [];
      }

      this.player.applyForce(force);
      if (boost) {
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

    let boost = false;
    if (signChanges >= 3) {
      boost = true;
      this.keyboardMovements = [];
    }

    if (isMoving) {
      this.player.applyForce(force);
      if (boost) {
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
        }
      }
    });
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
      
      // Demo mode: if on the title screen, auto apply a random force to the ball
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

      // Send our current player position to other peers (throttled every 100ms)
      if (this.gameState === "PLAY" && performance.now() - this.lastSentPosition > 100) {
        this.room.send({
          type: "position-update",
          position: { 
            x: this.player.mesh.position.x, 
            y: this.player.mesh.position.y, 
            z: this.player.mesh.position.z 
          }
        });
        this.lastSentPosition = performance.now();
      }

      // Update the minimap with local player and peer positions
      this.minimap.update(this.player, this.peerPlayers);

      this.renderer.render(this.scene, this.camera);
      this.frame++;
    };

    this.frame = 0;
    animate();
  }
}

new Game();
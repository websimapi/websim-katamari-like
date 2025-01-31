import { CityGenerator } from './cityGenerator.js';
import { PlayerBall } from './playerBall.js';

class Game {
  constructor() {
    // Create camera first
    this.camera = new THREE.PerspectiveCamera(
      75,
      window.innerWidth / window.innerHeight,
      0.1,
      1000
    );
    this.camera.position.set(0, 10, 20);
    this.camera.lookAt(0, 0, 0);

    this.setupScene();
    this.setupPhysics();
    this.setupLights();

    this.cityGenerator = new CityGenerator(this.scene, this.world);
    this.player = new PlayerBall(this.scene, this.world);

    // Add ground
    this.addGround();

    this.setupControls();
    this.setupCollisions();

    this.joystickMovements = [];

    // Load the audio file
    this.audio = new Audio('Electric Dreamers - Track 2 - Sonauto (2).wav');
    this.audio.loop = true;
    this.audioPlayed = false;

    // Play audio on first tap of screen
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

    this.start();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    
    // Enhanced sky gradient
    const verticalGradient = {
      topColor: new THREE.Color(0x1a4b77),    // Deeper blue at top
      bottomColor: new THREE.Color(0x87ceeb)   // Lighter blue at horizon
    };
    
    const skyMaterial = new THREE.ShaderMaterial({
      uniforms: {
        topColor: { value: verticalGradient.topColor },
        bottomColor: { value: verticalGradient.bottomColor }
      },
      vertexShader: `
        varying vec3 vWorldPosition;
        void main() {
          vec4 worldPosition = modelMatrix * vec4(position, 1.0);
          vWorldPosition = worldPosition.xyz;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPosition;
        void main() {
          float h = normalize(vWorldPosition).y;
          float gradient = max(pow(max(h, 0.0), 0.4), 0.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, gradient), 1.0);
        }
      `,
      side: THREE.BackSide
    });

    const skyGeometry = new THREE.SphereGeometry(500, 32, 32);
    const skyDome = new THREE.Mesh(skyGeometry, skyMaterial);
    this.scene.add(skyDome);

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('gameCanvas'),
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); 
    this.renderer.powerPreference = "high-performance";
    this.renderer.physicallyCorrectLights = false;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  }

  setupPhysics() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.81, 0);
    this.world.broadphase = new CANNON.NaiveBroadphase();
    this.world.solver.iterations = 7; 
    this.world.defaultContactMaterial.friction = 0.5;
    this.world.defaultContactMaterial.restitution = 0.3;

    // Add performance optimizations
    this.world.broadphase = new CANNON.SAPBroadphase(this.world);
    this.world.allowSleep = true;
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
    this.joystick = nipplejs.create({
      zone: document.getElementById('joystick-area'),
      mode: 'static',
      position: { left: '60px', bottom: '60px' },
      color: 'white'
    });

    this.joystick.on('move', (evt, data) => {
      const maxForce = 5;
      const force = {
        x: data.vector.x * maxForce,
        y: -data.vector.y * maxForce
      };

      // Record the current directionY and timestamp
      const currentTime = performance.now();
      const directionY = data.vector.y;

      if (Math.abs(directionY) > 0.5) { // Threshold to filter small movements
        this.joystickMovements.push({ time: currentTime, directionY: directionY });
      }

      // Remove old joystick movements (older than 500 ms)
      this.joystickMovements = this.joystickMovements.filter(m => currentTime - m.time < 500);

      // Check for rapid opposite direction movements
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
        // Clear movements to prevent immediate re-trigger
        this.joystickMovements = [];
      }

      this.player.applyForce(force);
      if (boost) {
        this.player.triggerBoost(3000); // Boost lasts 3 seconds
      }
    });

    this.joystick.on('end', () => {
      this.player.setBoosting(false);
    });

    this.keys = {};
    this.keyboardMovements = [];

    window.addEventListener('keydown', (e) => {
      this.keys[e.key] = true;
      this.updateKeyboardControls();
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.key] = false;
      this.updateKeyboardControls();
    });
  }

  updateKeyboardControls() {
    const force = { x: 0, y: 0 };
    const speed = 5;
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

    if (isMoving && Math.abs(directionY) > 0.5) { // Threshold to filter small movements
      this.keyboardMovements.push({ time: currentTime, directionY: directionY });
    }

    // Remove old keyboard movements (older than 500 ms)
    this.keyboardMovements = this.keyboardMovements.filter(m => currentTime - m.time < 500);

    // Check for rapid opposite direction movements
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
      // Clear movements to prevent immediate re-trigger
      this.keyboardMovements = [];
    }

    if (isMoving) {
      this.player.applyForce(force);
      if (boost) {
        this.player.triggerBoost(3000); // Boost lasts 3 seconds
      }
    } else {
      this.player.setBoosting(false);
    }
  }

  setupCollisions() {
    this.player.body.addEventListener('collide', (event) => {
      const otherBody = event.body;

      if (otherBody.mass === 0) return;

      const object = Array.from(this.cityGenerator.objects.values())
        .flat()
        .find((obj) => obj.body === otherBody);

      if (object) {
        const objectSize =
          object.body.shapes[0].radius ||
          Math.max(
            object.body.shapes[0].halfExtents.x,
            object.body.shapes[0].halfExtents.y,
            object.body.shapes[0].halfExtents.z
          );

        if (objectSize < this.player.radius) {
          this.player.absorbObject(object);

          for (let [key, objects] of this.cityGenerator.objects.entries()) {
            const index = objects.findIndex((obj) => obj.body === otherBody);
            if (index !== -1) {
              objects.splice(index, 1);
              break;
            }
          }

          document.getElementById('size-value').textContent =
            this.player.getSize().toFixed(1);
          document.getElementById('score-value').textContent =
            this.player.getCollectedCount();
        }
      }
    });
  }

  updateCamera() {
    const playerPos = this.player.mesh.position;
    const cameraOffset = new THREE.Vector3(
      0,
      10 + this.player.radius * 2,
      20 + this.player.radius * 3
    );
    this.camera.position.copy(playerPos).add(cameraOffset);
    this.camera.lookAt(playerPos);
  }

  start() {
    let lastTime = performance.now();
    const fixedTimeStep = 1.0 / 60.0; 
    const maxSubSteps = 3; 

    const animate = () => {
      requestAnimationFrame(animate);
      
      const time = performance.now();
      const deltaTime = (time - lastTime) / 1000;
      lastTime = time;

      // Update physics with fixed timestep
      this.world.step(fixedTimeStep, deltaTime, maxSubSteps);
      
      this.player.update();
      this.updateCamera();
      this.cityGenerator.update(this.player.body.position);

      this.renderer.render(this.scene, this.camera);
    };

    animate();
  }
}

new Game();
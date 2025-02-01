import { CityGenerator } from './cityGenerator.js';
import { PlayerBall } from './playerBall.js';
import { PickupPreview } from './pickupPreview.js';

class Game {
  constructor() {
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

    this.clock = new THREE.Clock();
    this.fixedTimeStep = 1.0 / 60.0;
    this.maxSubSteps = 3;

    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.shadowMap.enabled = false;
    
    this.bloomPass.strength = 1.5;
    this.bloomPass.radius = 0.5;
    this.bloomPass.threshold = 0.85;
    
    this._playerPos = new THREE.Vector3();
    this._temp = new THREE.Vector3();
    
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // Initialize the pickup preview UI
    this.pickupPreview = new PickupPreview();

    this.start();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87ceeb);

    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('gameCanvas'),
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);

    this.composer = new THREE.EffectComposer(this.renderer);
    this.renderPass = new THREE.RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);

    this.bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5,
      0.5,
      0.85
    );
    this.composer.addPass(this.bloomPass);
  }

  onWindowResize() {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
    this.composer.setSize(width, height);
  }

  setupPhysics() {
    this.world = new CANNON.World();
    // Increase gravity strength as per previous instructions
    this.world.gravity.set(0, -20, 0);
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
        this.player.triggerBoost(3000);
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
        this.player.triggerBoost(3000);
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
      if (!object) return;

      // Prevent processing already absorbed objects or objects with missing shapes
      if (object.absorbed || !object.body.shapes || object.body.shapes.length === 0) return;

      const objectShape = object.body.shapes[0];
      const objectSize = objectShape.radius ||
        Math.max(
          objectShape.halfExtents.x,
          objectShape.halfExtents.y,
          objectShape.halfExtents.z
        );

      if (objectSize < this.player.radius) {
        // Mark object as absorbed to avoid multiple triggers
        object.absorbed = true;
        // Create a preview clone and update the pickup UI before absorbing the object
        const previewClone = object.mesh.clone();
        const itemName = object.mesh.userData.itemName || "Collectible";
        this.pickupPreview.update(previewClone, itemName);

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

  updateGlowingObjects() {
    const playerRadius = this.player.radius;
    this._playerPos.copy(this.player.body.position);
    const glowRange = 10;

    this.cityGenerator.objects.forEach((objects) => {
      objects.forEach((obj) => {
        if (!obj.mesh) return;
        const objectSize = obj.body.shapes[0].radius ||
          Math.max(
            obj.body.shapes[0].halfExtents.x,
            obj.body.shapes[0].halfExtents.y,
            obj.body.shapes[0].halfExtents.z
          );
        this._temp.set(
          obj.body.position.x,
          obj.body.position.y,
          obj.body.position.z
        );
        
        const distance = this._temp.distanceTo(this._playerPos);

        if (objectSize < playerRadius && distance < glowRange) {
          if (!obj.mesh.userData.isGlowing) {
            obj.mesh.userData.isGlowing = true;
            if (!obj.mesh.userData.emissiveMaterial) {
              obj.mesh.userData.emissiveMaterial = new THREE.MeshPhongMaterial({
                color: obj.mesh.material.color,
                emissive: obj.mesh.material.color,
                emissiveIntensity: 0.5
              });
              obj.mesh.userData.originalMaterial = obj.mesh.material;
            }
            obj.mesh.material = obj.mesh.userData.emissiveMaterial;
          }
        } else if (obj.mesh.userData.isGlowing) {
          obj.mesh.userData.isGlowing = false;
          obj.mesh.material = obj.mesh.userData.originalMaterial || obj.mesh.material;
        }
      });
    });
  }

  start() {
    const animate = () => {
      requestAnimationFrame(animate);

      const delta = this.clock.getDelta();
      this.world.step(this.fixedTimeStep, delta, this.maxSubSteps);
      
      this.player.update();
      this.updateCamera();
      
      if (this.frame % 2 === 0) {
        this.cityGenerator.update(this.player.body.position);
        this.updateGlowingObjects();
      }
      
      this.composer.render();
      this.frame++;
    };

    this.frame = 0;
    animate();
  }
}

new Game();
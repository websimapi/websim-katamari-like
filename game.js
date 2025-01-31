import { CityGenerator } from './cityGenerator.js';
import { PlayerBall } from './playerBall.js';

export class Game {
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
    this.start();
  }

  setupScene() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x87CEEB);
    
    this.renderer = new THREE.WebGLRenderer({
      canvas: document.getElementById('gameCanvas'),
      antialias: true
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Add post-processing for bloom effect
    this.composer = new THREE.EffectComposer(this.renderer);
    this.renderPass = new THREE.RenderPass(this.scene, this.camera);
    this.composer.addPass(this.renderPass);
    
    this.bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
      1.5, // strength
      0.4, // radius
      0.85 // threshold
    );
    this.composer.addPass(this.bloomPass);
  }

  setupPhysics() {
    this.world = new CANNON.World();
    this.world.gravity.set(0, -9.81, 0);
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
    // Three.js ground
    const groundGeometry = new THREE.PlaneGeometry(1000, 1000);
    const groundMaterial = new THREE.MeshPhongMaterial({ color: 0x999999 });
    const groundMesh = new THREE.Mesh(groundGeometry, groundMaterial);
    groundMesh.rotation.x = -Math.PI / 2;
    this.scene.add(groundMesh);

    // Cannon.js ground
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
      const force = {
        x: data.vector.x * 5,
        y: -data.vector.y * 5
      };
      this.player.applyForce(force);
    });

    window.addEventListener('keydown', (e) => {
      const force = { x: 0, y: 0 };
      const speed = 5;
      
      switch(e.key) {
        case 'ArrowUp': force.y = -speed; break;
        case 'ArrowDown': force.y = speed; break;
        case 'ArrowLeft': force.x = -speed; break;
        case 'ArrowRight': force.x = speed; break;
      }
      
      this.player.applyForce(force);
    });
  }

  setupCollisions() {
    this.player.body.addEventListener('collide', (event) => {
      const otherBody = event.body;

      // Skip if other body is the ground (mass === 0)
      if (otherBody.mass === 0) return;

      // Find the object that corresponds to this physics body
      const object = Array.from(this.cityGenerator.objects.values())
        .flat()
        .find(obj => obj.body === otherBody);
      
      if (object) {
        const objectSize = object.body.shapes[0].radius || 
                         Math.max(
                           object.body.shapes[0].halfExtents.x,
                           object.body.shapes[0].halfExtents.y,
                           object.body.shapes[0].halfExtents.z
                         );
        
        // Only absorb if the object is smaller than the player
        if (objectSize < this.player.radius) {
          this.player.absorbObject(object);

          // Remove the object from the city generator's records
          for (let [key, objects] of this.cityGenerator.objects.entries()) {
            const index = objects.findIndex(obj => obj.body === otherBody);
            if (index !== -1) {
              objects.splice(index, 1);
              break;
            }
          }

          // Update UI
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
    const cameraOffset = new THREE.Vector3(0, 10 + this.player.radius * 2, 20 + this.player.radius * 3);
    this.camera.position.copy(playerPos).add(cameraOffset);
    this.camera.lookAt(playerPos);
  }

  updateGlowingObjects() {
    const playerRadius = this.player.radius;
    const playerPosition = this.player.body.position;

    // Update all objects in loaded chunks
    this.cityGenerator.objects.forEach((objects) => {
      objects.forEach((obj) => {
        const objectSize = obj.body.shapes[0].radius || 
                         Math.max(
                           obj.body.shapes[0].halfExtents.x,
                           obj.body.shapes[0].halfExtents.y,
                           obj.body.shapes[0].halfExtents.z
                         );
        
        const distance = new THREE.Vector3(
          obj.body.position.x,
          obj.body.position.y,
          obj.body.position.z
        ).distanceTo(new THREE.Vector3(
          playerPosition.x,
          playerPosition.y,
          playerPosition.z
        ));

        // If object is smaller than player and within range
        if (objectSize < playerRadius && distance < 10) {
          if (!obj.mesh.userData.isGlowing) {
            obj.mesh.userData.isGlowing = true;
            obj.mesh.userData.originalMaterial = obj.mesh.material;
            obj.mesh.material = new THREE.MeshPhongMaterial({
              color: obj.mesh.userData.originalMaterial.color,
              emissive: obj.mesh.userData.originalMaterial.color,
              emissiveIntensity: 0.5
            });
          }
        } else if (obj.mesh.userData.isGlowing) {
          obj.mesh.userData.isGlowing = false;
          obj.mesh.material = obj.mesh.userData.originalMaterial;
        }
      });
    });
  }

  start() {
    const animate = () => {
      requestAnimationFrame(animate);
      
      this.world.step(1/60);
      this.player.update();
      this.updateCamera();
      this.cityGenerator.update(this.player.body.position);
      this.updateGlowingObjects();
      
      this.composer.render();
    };
    
    animate();
  }
}
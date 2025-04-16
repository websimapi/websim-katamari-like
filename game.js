import { CityGenerator } from './cityGenerator.js';
import { PlayerBall } from './playerBall.js';
import { PickupPreview } from './pickupPreview.js';
import { Minimap } from './minimap.js';
import { InputController } from './InputController.js';
import { PhysicsManager } from './PhysicsManager.js';
import { CameraController } from './CameraController.js';
import { DemoController } from './DemoController.js';
import { CollisionHandler } from './CollisionHandler.js';
import { MultiplayerManager } from './MultiplayerManager.js';
import { SceneManager } from './SceneManager.js';

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

    // Initialize core systems
    this.sceneManager = new SceneManager();
    this.scene = this.sceneManager.scene;
    this.renderer = this.sceneManager.renderer;
    
    this.physicsManager = new PhysicsManager();
    this.world = this.physicsManager.world;
    this.physicsManager.addGround();

    // Create the city and player
    this.cityGenerator = new CityGenerator(this.scene, this.world);
    this.player = new PlayerBall(this.scene, this.world);
    // Ensure initial player position is near the center
    this.player.body.position.set(0, this.player.radius, 0);
    this.player.mesh.position.copy(this.player.body.position);
    // Initialize additional properties for player collisions
    this.player.isStuck = false;
    this.player.stuckTo = null;

    // Initialize subsystems
    this.inputController = new InputController(this);
    this.cameraController = new CameraController(this.camera);
    this.demoController = new DemoController(this.player);
    this.multiplayerManager = new MultiplayerManager(this);
    this.room = this.multiplayerManager.room;
    this.peerPlayers = this.multiplayerManager.peerPlayers;
    this.peerBodies = this.multiplayerManager.peerBodies;
    this.collisionHandler = new CollisionHandler(this);
    
    // Initialize UI components
    this.pickupPreview = new PickupPreview();
    this.minimap = new Minimap();

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

    // Setup Title Screen input listener
    const titleScreenEl = document.getElementById('title-screen');
    titleScreenEl.addEventListener('pointerdown', () => {
      // Transition to play mode: hide the title screen overlay
      titleScreenEl.style.display = 'none';
      this.gameState = "PLAY";
      // Reset camera to follow player normally
      this.camera.position.set(0, 10 + this.player.radius * 2, 20 + this.player.radius * 3);
      this.camera.lookAt(this.player.mesh.position);
    }, { once: true });

    this.start();
  }

  start() {
    this.frame = 0;
    this.clock = new THREE.Clock();
    this.fixedTimeStep = 1.0 / 60.0;
    this.maxSubSteps = 3;
    
    const animate = () => {
      requestAnimationFrame(animate);

      const delta = this.clock.getDelta();
      this.physicsManager.step(this.fixedTimeStep, delta, this.maxSubSteps);
      
      // In demo mode, automatically apply a random force to the ball
      if (this.gameState === "TITLE") {
        this.demoController.update(delta);
      }

      this.player.update();
      
      // Check collisions between local player and remote players
      this.collisionHandler.checkPlayerCollisions();
      
      // Update camera position based on game state
      this.cameraController.update(this.gameState, this.player, delta);
      
      // Update city chunks every other frame for performance
      if (this.frame % 2 === 0) {
        this.cityGenerator.update(this.player.body.position);
      }
      
      // Update flying creatures
      const currentTime = performance.now() / 1000;
      this.cityGenerator.objects.forEach(chunkData => {
        chunkData.flying.forEach(creature => {
          creature.update(currentTime);
        });
      });

      // Send player state to peers
      this.multiplayerManager.sendPlayerState(this.gameState);

      // Update peer physics/visuals
      this.multiplayerManager.updatePeers();

      // Update the minimap
      this.minimap.update(this.player, this.peerPlayers);

      // Render the scene
      this.sceneManager.render(this.camera);
      
      this.frame++;
    };

    animate();
  }
}

// Initialize the game
new Game();
export class InputController {
  constructor(game) {
    this.game = game;
    this.player = game.player;
    this.gameState = game.gameState;
    this.keys = {};
    this.joystickMovements = [];
    this.keyboardMovements = [];
    
    this.setupControls();
  }

  setupControls() {
    // Setup joystick controls for mobile
    this.joystick = nipplejs.create({
      zone: document.getElementById('joystick-area'),
      mode: 'static',
      position: { left: '60px', bottom: '60px' },
      color: 'white'
    });

    this.joystick.on('move', (evt, data) => {
      // Only process input if in PLAY mode
      if (this.game.gameState !== "PLAY") return;
      
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

    // Keyboard controls
    window.addEventListener('keydown', (e) => {
      if (this.game.gameState !== "PLAY") return;
      this.keys[e.key] = true;
      this.updateKeyboardControls();
    });

    window.addEventListener('keyup', (e) => {
      if (this.game.gameState !== "PLAY") return;
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
}
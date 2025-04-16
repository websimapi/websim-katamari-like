export class DemoController {
  constructor(player) {
    this.player = player;
    this.demoTimer = 0;
    this.demoDirection = new THREE.Vector2(0, 0);
  }

  update(delta) {
    this.demoTimer += delta;
    if (this.demoTimer >= 2) {
      // Choose a new random direction every 2 seconds
      this.demoDirection.set(Math.random() * 2 - 1, Math.random() * 2 - 1).normalize();
      this.demoTimer = 0;
    }
    this.player.applyForce({ 
      x: this.demoDirection.x * 5, 
      y: this.demoDirection.y * 5 
    });
  }
}


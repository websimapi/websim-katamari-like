export class CameraController {
  constructor(camera) {
    this.camera = camera;
    this.demoOrbitAngle = 0;
  }
  
  update(gameState, player, delta) {
    if (gameState === "TITLE") {
      // In demo mode, slowly orbit around the player for an attractive pan effect
      this.demoOrbitAngle += delta * 0.1;
      const orbitRadius = 40;
      const playerPos = player.mesh.position;
      this.camera.position.set(
        playerPos.x + orbitRadius * Math.cos(this.demoOrbitAngle),
        playerPos.y + 20,
        playerPos.z + orbitRadius * Math.sin(this.demoOrbitAngle)
      );
      this.camera.lookAt(playerPos);
    } else {
      // In play mode, follow the player with an offset
      const playerPos = player.mesh.position;
      const cameraOffset = new THREE.Vector3(
        0,
        10 + player.radius * 2,
        20 + player.radius * 3
      );
      this.camera.position.copy(playerPos).add(cameraOffset);
      this.camera.lookAt(playerPos);
    }
  }
}
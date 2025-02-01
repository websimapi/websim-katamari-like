export class Minimap {
  constructor() {
    this.canvas = document.getElementById('minimap-canvas');
    this.ctx = this.canvas.getContext('2d');
    // Set a fixed size as defined in the HTML/CSS (e.g., 150x150)
    this.width = this.canvas.width;
    this.height = this.canvas.height;
    // Scale factor: how many pixels per world unit (tweak as needed)
    this.scale = 2;
  }

  update(localPlayer, peerPlayers) {
    // Clear the minimap
    this.ctx.clearRect(0, 0, this.width, this.height);
    
    // Draw background
    this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    this.ctx.fillRect(0, 0, this.width, this.height);
    
    // The center of the minimap corresponds to the local player's position
    const centerX = this.width / 2;
    const centerY = this.height / 2;
    
    // Draw a grid (optional)
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    this.ctx.lineWidth = 1;
    for (let x = centerX % 20; x < this.width; x += 20) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, this.height);
      this.ctx.stroke();
    }
    for (let y = centerY % 20; y < this.height; y += 20) {
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(this.width, y);
      this.ctx.stroke();
    }
    
    // Draw local player's indicator (e.g., a blue circle)
    this.ctx.fillStyle = 'blue';
    this.drawIndicator(centerX, centerY, 5);
    
    // Draw peer players as red circles relative to local player's position
    Object.keys(peerPlayers).forEach(clientId => {
      const peer = peerPlayers[clientId];
      const dx = peer.position.x - localPlayer.mesh.position.x;
      const dz = peer.position.z - localPlayer.mesh.position.z;
      const x = centerX + dx * this.scale;
      const y = centerY + dz * this.scale;
      this.ctx.fillStyle = 'red';
      this.drawIndicator(x, y, 5);
    });
    
    // Draw a border around the minimap
    this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
    this.ctx.lineWidth = 2;
    this.ctx.strokeRect(0, 0, this.width, this.height);
  }

  drawIndicator(x, y, radius) {
    this.ctx.beginPath();
    this.ctx.arc(x, y, radius, 0, 2 * Math.PI);
    this.ctx.fill();
  }
}
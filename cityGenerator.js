export class CityGenerator {
  constructor(world) {
    this.world = world;
    this.chunkSize = 1000;
    this.loadedChunks = new Set();
    this.objects = new Map();
  }

  update(playerPosition) {
    const currentChunk = this.getChunkCoords(playerPosition);
    const nearbyChunks = this.getNearbyChunks(currentChunk);
    
    // Generate new chunks
    nearbyChunks.forEach(chunk => {
      const key = `${chunk.x},${chunk.y}`;
      if (!this.loadedChunks.has(key)) {
        this.generateChunk(chunk);
        this.loadedChunks.add(key);
      }
    });

    // Remove far chunks
    this.loadedChunks.forEach(key => {
      const [x, y] = key.split(',').map(Number);
      const distance = Math.sqrt(
        Math.pow(x - currentChunk.x, 2) + 
        Math.pow(y - currentChunk.y, 2)
      );
      
      if (distance > 2) {
        this.removeChunk({ x, y });
        this.loadedChunks.delete(key);
      }
    });
  }

  getChunkCoords(position) {
    return {
      x: Math.floor(position.x / this.chunkSize),
      y: Math.floor(position.y / this.chunkSize)
    };
  }

  getNearbyChunks(chunk) {
    const nearby = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        nearby.push({
          x: chunk.x + dx,
          y: chunk.y + dy
        });
      }
    }
    return nearby;
  }

  generateChunk(chunk) {
    const objects = [];
    const chunkObjects = [];
    
    // Generate buildings
    for (let i = 0; i < 10; i++) {
      const x = (chunk.x * this.chunkSize) + Math.random() * this.chunkSize;
      const y = (chunk.y * this.chunkSize) + Math.random() * this.chunkSize;
      const size = 20 + Math.random() * 60;
      
      const building = Matter.Bodies.rectangle(x, y, size, size, {
        isStatic: true,
        render: {
          fillStyle: '#808080'
        }
      });
      
      objects.push(building);
      chunkObjects.push(building);
    }

    // Generate collectibles
    for (let i = 0; i < 20; i++) {
      const x = (chunk.x * this.chunkSize) + Math.random() * this.chunkSize;
      const y = (chunk.y * this.chunkSize) + Math.random() * this.chunkSize;
      const size = 5 + Math.random() * 15;
      
      const collectible = Matter.Bodies.circle(x, y, size, {
        render: {
          fillStyle: this.getRandomColor()
        }
      });
      
      objects.push(collectible);
      chunkObjects.push(collectible);
    }

    Matter.World.add(this.world, objects);
    this.objects.set(`${chunk.x},${chunk.y}`, chunkObjects);
  }

  removeChunk(chunk) {
    const key = `${chunk.x},${chunk.y}`;
    const objects = this.objects.get(key);
    if (objects) {
      Matter.World.remove(this.world, objects);
      this.objects.delete(key);
    }
  }

  getRandomColor() {
    const colors = ['#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
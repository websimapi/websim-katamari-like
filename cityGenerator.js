export class CityGenerator {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.chunkSize = 100;
    this.loadedChunks = new Set();
    this.objects = new Map();
    this.minObjectSize = 0.2; // Minimum size for collectibles
    this.maxObjectSize = 8;   // Maximum size for buildings
  }

  update(playerPosition) {
    const currentChunk = this.getChunkCoords(playerPosition);
    const nearbyChunks = this.getNearbyChunks(currentChunk);
    
    // Generate new chunks
    nearbyChunks.forEach(chunk => {
      const key = `${chunk.x},${chunk.z}`;
      if (!this.loadedChunks.has(key)) {
        this.generateChunk(chunk);
        this.loadedChunks.add(key);
      }
    });

    // Remove far chunks
    this.loadedChunks.forEach(key => {
      const [x, z] = key.split(',').map(Number);
      const distance = Math.sqrt(
        Math.pow(x - currentChunk.x, 2) + 
        Math.pow(z - currentChunk.z, 2)
      );
      
      if (distance > 2) {
        this.removeChunk({ x, z });
        this.loadedChunks.delete(key);
      }
    });
  }

  getChunkCoords(position) {
    return {
      x: Math.floor(position.x / this.chunkSize),
      z: Math.floor(position.z / this.chunkSize)
    };
  }

  getNearbyChunks(chunk) {
    const nearby = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        nearby.push({
          x: chunk.x + dx,
          z: chunk.z + dz
        });
      }
    }
    return nearby;
  }

  generateChunk(chunk) {
    const objects = [];
    
    // Generate tiny collectibles (leaves, papers, etc)
    for (let i = 0; i < 30; i++) {
      const x = (chunk.x * this.chunkSize) + Math.random() * this.chunkSize;
      const z = (chunk.z * this.chunkSize) + Math.random() * this.chunkSize;
      const size = this.minObjectSize + Math.random() * 0.3; // 0.2 to 0.5
      
      const geometry = new THREE.SphereGeometry(size, 8, 8);
      const material = new THREE.MeshPhongMaterial({ 
        color: this.getRandomColor(),
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, size, z);
      this.scene.add(mesh);

      const shape = new CANNON.Sphere(size);
      const body = new CANNON.Body({
        mass: size * 2,
        shape: shape,
        position: new CANNON.Vec3(x, size, z)
      });
      this.world.addBody(body);

      objects.push({ mesh, body });
    }

    // Generate medium collectibles (trash bins, boxes, etc)
    for (let i = 0; i < 15; i++) {
      const x = (chunk.x * this.chunkSize) + Math.random() * this.chunkSize;
      const z = (chunk.z * this.chunkSize) + Math.random() * this.chunkSize;
      const size = 0.5 + Math.random() * 1; // 0.5 to 1.5
      
      const geometry = new THREE.BoxGeometry(size, size, size);
      const material = new THREE.MeshPhongMaterial({ color: this.getRandomColor() });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, size/2, z);
      this.scene.add(mesh);

      const shape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2));
      const body = new CANNON.Body({
        mass: size * 3,
        shape: shape,
        position: new CANNON.Vec3(x, size/2, z)
      });
      this.world.addBody(body);

      objects.push({ mesh, body });
    }
    
    // Generate buildings of varying sizes
    for (let i = 0; i < 8; i++) {
      const x = (chunk.x * this.chunkSize) + Math.random() * this.chunkSize;
      const z = (chunk.z * this.chunkSize) + Math.random() * this.chunkSize;
      const width = 2 + Math.random() * 4; // 2 to 6
      const height = 4 + Math.random() * 12; // 4 to 16
      
      const geometry = new THREE.BoxGeometry(width, height, width);
      const material = new THREE.MeshPhongMaterial({ 
        color: 0x808080,
        flatShading: true
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, height/2, z);
      this.scene.add(mesh);

      const shape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, width/2));
      const body = new CANNON.Body({
        mass: width * height * 2, // Mass proportional to volume
        shape: shape,
        position: new CANNON.Vec3(x, height/2, z)
      });
      this.world.addBody(body);

      objects.push({ mesh, body });
    }

    this.objects.set(`${chunk.x},${chunk.z}`, objects);
  }

  removeChunk(chunk) {
    const key = `${chunk.x},${chunk.z}`;
    const objects = this.objects.get(key);
    if (objects) {
      objects.forEach(obj => {
        this.scene.remove(obj.mesh);
        this.world.remove(obj.body);
      });
      this.objects.delete(key);
    }
  }

  getRandomColor() {
    const colors = [
      0xFF0000, // red
      0x00FF00, // green
      0x0000FF, // blue
      0xFFFF00, // yellow
      0xFF00FF, // magenta
      0x00FFFF, // cyan
      0xFFA500, // orange
      0x800080  // purple
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
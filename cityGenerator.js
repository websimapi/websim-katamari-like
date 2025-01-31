export class CityGenerator {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.chunkSize = 100;
    this.loadedChunks = new Set();
    this.objects = new Map();
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
    
    // Generate buildings
    for (let i = 0; i < 10; i++) {
      const x = (chunk.x * this.chunkSize) + Math.random() * this.chunkSize;
      const z = (chunk.z * this.chunkSize) + Math.random() * this.chunkSize;
      const size = 2 + Math.random() * 6;
      const height = 5 + Math.random() * 20;
      
      // Three.js geometry
      const geometry = new THREE.BoxGeometry(size, height, size);
      const material = new THREE.MeshPhongMaterial({ color: 0x808080 });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, height/2, z);
      this.scene.add(mesh);

      // Cannon.js body
      const shape = new CANNON.Box(new CANNON.Vec3(size/2, height/2, size/2));
      const body = new CANNON.Body({
        mass: 0,
        shape: shape,
        position: new CANNON.Vec3(x, height/2, z)
      });
      this.world.addBody(body);

      objects.push({ mesh, body });
    }

    // Generate collectibles
    for (let i = 0; i < 20; i++) {
      const x = (chunk.x * this.chunkSize) + Math.random() * this.chunkSize;
      const z = (chunk.z * this.chunkSize) + Math.random() * this.chunkSize;
      const size = 0.5 + Math.random() * 1.5;
      
      const geometry = new THREE.SphereGeometry(size, 16, 16);
      const material = new THREE.MeshPhongMaterial({ color: this.getRandomColor() });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(x, size, z);
      this.scene.add(mesh);

      const shape = new CANNON.Sphere(size);
      const body = new CANNON.Body({
        mass: size * 5,
        shape: shape,
        position: new CANNON.Vec3(x, size, z)
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
    const colors = [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF, 0x00FFFF];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
export class CityGenerator {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.chunkSize = 100;
    this.loadedChunks = new Set();
    this.objects = new Map();
    this.minObjectSize = 0.2;   // Minimum size for collectibles
    this.maxObjectSize = 15;    // Maximum size for buildings
    this.renderDistance = 2;  // Default render distance
  }

  setRenderDistance(distance) {
    if (this.renderDistance !== distance) {
      this.renderDistance = distance;
      // Clear all chunks and regenerate based on new render distance
      Array.from(this.loadedChunks).forEach(key => {
        const [x, z] = key.split(',').map(Number);
        this.removeChunk({ x, z });
      });
      this.loadedChunks.clear();
    }
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
      
      if (distance > this.renderDistance) {
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
    for (let dx = -this.renderDistance; dx <= this.renderDistance; dx++) {
      for (let dz = -this.renderDistance; dz <= this.renderDistance; dz++) {
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
    const occupiedSpaces = new Set();
    
    // Function to check if a position is too close to existing objects
    const isSpaceOccupied = (x, z, size) => {
      // Check in a grid around the object based on its size
      const gridSize = Math.ceil(size);
      for (let dx = -gridSize; dx <= gridSize; dx++) {
        for (let dz = -gridSize; dz <= gridSize; dz++) {
          const key = `${Math.round((x + dx)/2)},${Math.round((z + dz)/2)}`;
          if (occupiedSpaces.has(key)) return true;
        }
      }
      
      // If space is free, mark it as occupied
      for (let dx = -gridSize; dx <= gridSize; dx++) {
        for (let dz = -gridSize; dz <= gridSize; dz++) {
          const key = `${Math.round((x + dx)/2)},${Math.round((z + dz)/2)}`;
          occupiedSpaces.add(key);
        }
      }
      return false;
    };

    // Function to get valid spawn position
    const getValidPosition = (size) => {
      let attempts = 0;
      let x, z;
      do {
        x = (chunk.x * this.chunkSize) + (size * 2) + Math.random() * (this.chunkSize - size * 4);
        z = (chunk.z * this.chunkSize) + (size * 2) + Math.random() * (this.chunkSize - size * 4);
        attempts++;
      } while (isSpaceOccupied(x, z, size) && attempts < 50);
      
      return attempts < 50 ? { x, z } : null;
    };

    // Generate tiny collectibles (leaves, papers, etc)
    for (let i = 0; i < 50; i++) {  
      const size = this.minObjectSize + Math.random() * 0.3;
      const pos = getValidPosition(size);
      if (!pos) continue;
      
      let mesh;
      if (Math.random() < 0.5) {
        // Paper-like object
        const geometry = new THREE.PlaneGeometry(size * 2, size * 2);
        const material = new THREE.MeshPhongMaterial({ 
          color: 0xFFFFFF,
          side: THREE.DoubleSide,
          flatShading: true
        });
        mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.random() * Math.PI;
        mesh.rotation.y = Math.random() * Math.PI;
      } else {
        // Crumpled paper ball or small debris
        const geometry = new THREE.IcosahedronGeometry(size, 1);
        const material = new THREE.MeshPhongMaterial({ 
          color: this.getRandomColor(),
          flatShading: true,
          shininess: 0
        });
        mesh = new THREE.Mesh(geometry, material);
      }
      mesh.position.set(pos.x, size, pos.z);
      this.scene.add(mesh);

      const shape = new CANNON.Sphere(size);
      const body = new CANNON.Body({
        mass: size * 2,
        shape: shape,
        position: new CANNON.Vec3(pos.x, size, pos.z)
      });
      this.world.addBody(body);

      objects.push({ mesh, body });
    }

    // Generate medium collectibles (trash bins, boxes, etc)
    for (let i = 0; i < 25; i++) {  
      const size = 0.5 + Math.random() * 2;
      const pos = getValidPosition(size);
      if (!pos) continue;
      
      let mesh;
      if (Math.random() < 0.5) {
        // Trash bin
        const group = new THREE.Group();
        
        // Main body
        const bodyGeometry = new THREE.CylinderGeometry(size/2, size/2 * 0.8, size, 8);
        const bodyMaterial = new THREE.MeshPhongMaterial({ 
          color: this.getRandomColor(),
          flatShading: true
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        group.add(body);
        
        // Rim
        const rimGeometry = new THREE.TorusGeometry(size/2 * 1.1, size/10, 8, 8);
        const rim = new THREE.Mesh(rimGeometry, bodyMaterial);
        rim.position.y = size/2;
        group.add(rim);
        
        mesh = group;
      } else {
        // Detailed box
        const group = new THREE.Group();
        
        // Main box
        const boxGeometry = new THREE.BoxGeometry(size, size, size);
        const boxMaterial = new THREE.MeshPhongMaterial({ 
          color: this.getRandomColor(),
          flatShading: true
        });
        const box = new THREE.Mesh(boxGeometry, boxMaterial);
        group.add(box);
        
        // Edge details
        const edgeGeometry = new THREE.BoxGeometry(size * 1.1, size/10, size * 1.1);
        const edgeMaterial = new THREE.MeshPhongMaterial({ 
          color: 0x333333,
          flatShading: true
        });
        const topEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
        topEdge.position.y = size/2;
        group.add(topEdge);
        
        mesh = group;
      }
      
      mesh.position.set(pos.x, size/2, pos.z);
      this.scene.add(mesh);

      const shape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2));
      const body = new CANNON.Body({
        mass: size * 3,
        shape: shape,
        position: new CANNON.Vec3(pos.x, size/2, pos.z)
      });
      this.world.addBody(body);

      objects.push({ mesh, body });
    }

    // Generate large objects (cars, small structures)
    for (let i = 0; i < 10; i++) {
      const size = 2 + Math.random() * 3;
      const pos = getValidPosition(size * 2);
      if (!pos) continue;
      
      const group = new THREE.Group();
      
      if (Math.random() < 0.5) {
        // Car
        // Main body
        const bodyGeometry = new THREE.BoxGeometry(size * 2, size * 0.8, size * 1.5);
        const bodyMaterial = new THREE.MeshPhongMaterial({ 
          color: this.getRandomColor(),
          flatShading: true
        });
        const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
        group.add(body);
        
        // Top/cabin
        const cabinGeometry = new THREE.BoxGeometry(size * 1.2, size * 0.6, size);
        const cabin = new THREE.Mesh(cabinGeometry, bodyMaterial);
        cabin.position.y = size * 0.7;
        cabin.position.z = -size * 0.2;
        group.add(cabin);
        
        // Wheels
        const wheelGeometry = new THREE.CylinderGeometry(size * 0.3, size * 0.3, size * 0.2, 8);
        const wheelMaterial = new THREE.MeshPhongMaterial({ color: 0x333333 });
        for (let w = 0; w < 4; w++) {
          const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
          wheel.rotation.z = Math.PI/2;
          wheel.position.x = (w < 2 ? 1 : -1) * size * 0.8;
          wheel.position.z = (w % 2 ? 1 : -1) * size * 0.5;
          wheel.position.y = -size * 0.3;
          group.add(wheel);
        }
      } else {
        // Structure
        const levels = 2 + Math.floor(Math.random() * 3);
        for (let l = 0; l < levels; l++) {
          const levelGeometry = new THREE.BoxGeometry(
            size * (1 - l * 0.2),
            size,
            size * (1 - l * 0.2)
          );
          const levelMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x808080,
            flatShading: true
          });
          const level = new THREE.Mesh(levelGeometry, levelMaterial);
          level.position.y = l * size;
          group.add(level);
        }
      }
      
      group.position.set(pos.x, size/2, pos.z);
      this.scene.add(group);

      const shape = new CANNON.Box(new CANNON.Vec3(size, size/2, size * 0.75));
      const body = new CANNON.Body({
        mass: size * 10,
        shape: shape,
        position: new CANNON.Vec3(pos.x, size/2, pos.z)
      });
      this.world.addBody(body);

      objects.push({ mesh: group, body });
    }
    
    // Generate buildings
    for (let i = 0; i < 12; i++) {  
      const width = 3 + Math.random() * 5;   
      const height = 6 + Math.random() * 14;
      const size = Math.max(width, height);
      
      const pos = getValidPosition(width);
      if (!pos) continue;
      
      const group = new THREE.Group();
      
      // Main building structure
      const buildingGeometry = new THREE.BoxGeometry(width, height, width);
      const buildingMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x808080,
        flatShading: true
      });
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
      group.add(building);
      
      // Add windows
      const windowMaterial = new THREE.MeshPhongMaterial({ 
        color: 0x88CCFF,
        flatShading: true
      });
      const windowSize = 0.3;
      const windowSpacing = 1;
      for (let y = 1; y < height - 1; y += windowSpacing) {
        for (let x = -width/2 + 1; x < width/2; x += windowSpacing) {
          for (let z = -width/2 + 1; z < width/2; z += windowSpacing) {
            if (Math.random() < 0.7) {
              const windowGeometry = new THREE.BoxGeometry(windowSize, windowSize, 0.1);
              const windowPane = new THREE.Mesh(windowGeometry, windowMaterial);
              windowPane.position.set(x, y, width/2 + 0.1);
              group.add(windowPane.clone());
              windowPane.position.set(x, y, -width/2 - 0.1);
              group.add(windowPane.clone());
              windowPane.rotation.y = Math.PI/2;
              windowPane.position.set(width/2 + 0.1, y, z);
              group.add(windowPane.clone());
              windowPane.position.set(-width/2 - 0.1, y, z);
              group.add(windowPane.clone());
            }
          }
        }
      }
      
      // Add roof details
      const roofDetail = new THREE.Mesh(
        new THREE.BoxGeometry(width * 0.7, height * 0.1, width * 0.7),
        buildingMaterial
      );
      roofDetail.position.y = height/2 + height * 0.05;
      group.add(roofDetail);
      
      group.position.set(pos.x, height/2, pos.z);
      this.scene.add(group);

      const shape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, width/2));
      const body = new CANNON.Body({
        mass: width * height * 2,
        shape: shape,
        position: new CANNON.Vec3(pos.x, height/2, pos.z)
      });
      this.world.addBody(body);

      objects.push({ mesh: group, body });
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
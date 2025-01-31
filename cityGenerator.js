export class CityGenerator {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.chunkSize = 150; 
    this.loadedChunks = new Set();
    this.objects = new Map();
    this.minObjectSize = 0.2;   
    this.maxObjectSize = 15;    
    this.renderDistance = 1;  // Keep chunk distance small
    this.objectRenderDistance = 30; // 30 meter object render distance
  }

  update(playerPosition) {
    // Update chunk loading
    const currentChunk = this.getChunkCoords(playerPosition);
    const nearbyChunks = this.getNearbyChunks(currentChunk);
    
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

    // Update object visibility based on distance
    this.objects.forEach((objects, chunkKey) => {
      objects.forEach(obj => {
        const distanceToPlayer = Math.sqrt(
          Math.pow(obj.mesh.position.x - playerPosition.x, 2) +
          Math.pow(obj.mesh.position.z - playerPosition.z, 2)
        );

        // Show/hide objects based on distance
        if (distanceToPlayer <= this.objectRenderDistance) {
          if (!obj.mesh.visible) {
            obj.mesh.visible = true;
            obj.body.collisionResponse = true;
          }
        } else {
          if (obj.mesh.visible) {
            obj.mesh.visible = false;
            obj.body.collisionResponse = false; // Disable collision for far objects
          }
        }
      });
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
    
    const isSpaceOccupied = (x, z, size) => {
      const gridSize = Math.ceil(size * 1.2); 
      for (let dx = -gridSize; dx <= gridSize; dx++) {
        for (let dz = -gridSize; dz <= gridSize; dz++) {
          const key = `${Math.floor(x + dx)},${Math.floor(z + dz)}`;
          if (occupiedSpaces.has(key)) return true;
        }
      }
      
      for (let dx = -gridSize; dx <= gridSize; dx++) {
        for (let dz = -gridSize; dz <= gridSize; dz++) {
          const key = `${Math.floor(x + dx)},${Math.floor(z + dz)}`;
          occupiedSpaces.add(key);
        }
      }
      return false;
    };

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

    for (let i = 0; i < 30; i++) {  
      const size = this.minObjectSize + Math.random() * 0.3;
      const pos = getValidPosition(size);
      if (!pos) continue;
      
      const geometry = new THREE.SphereGeometry(size, 8, 8);
      const material = new THREE.MeshPhongMaterial({ 
        color: this.getRandomColor(),
      });
      const mesh = new THREE.Mesh(geometry, material);
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

    for (let i = 0; i < 15; i++) {  
      const size = 0.5 + Math.random() * 2;
      const pos = getValidPosition(size);
      if (!pos) continue;
      
      const geometry = new THREE.BoxGeometry(size, size, size);
      const material = new THREE.MeshPhongMaterial({ color: this.getRandomColor() });
      const mesh = new THREE.Mesh(geometry, material);
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

    for (let i = 0; i < 5; i++) {
      const size = 2 + Math.random() * 3;
      const pos = getValidPosition(size * 2);
      if (!pos) continue;
      
      const geometry = new THREE.BoxGeometry(size * 2, size, size * 1.5);
      const material = new THREE.MeshPhongMaterial({ 
        color: this.getRandomColor(),
        flatShading: true
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(pos.x, size/2, pos.z);
      this.scene.add(mesh);

      const shape = new CANNON.Box(new CANNON.Vec3(size, size/2, size * 0.75));
      const body = new CANNON.Body({
        mass: size * 10,
        shape: shape,
        position: new CANNON.Vec3(pos.x, size/2, pos.z)
      });
      this.world.addBody(body);

      objects.push({ mesh, body });
    }
    
    for (let i = 0; i < 8; i++) {  
      const width = 3 + Math.random() * 5;   
      const height = 6 + Math.random() * 14;
      const depth = width; 
      
      const pos = getValidPosition(width);
      if (!pos) continue;
      
      const buildingGroup = new THREE.Group();
      
      const buildingGeometry = new THREE.BoxGeometry(width, height, depth);
      const buildingMaterial = new THREE.MeshPhongMaterial({ 
        color: this.getRandomBuildingColor(),
        flatShading: true
      });
      const buildingMesh = new THREE.Mesh(buildingGeometry, buildingMaterial);
      
      const windowRows = Math.floor(height / 2) - 1;
      const windowCols = Math.floor(width / 1.5);
      const windowSize = 0.3;
      const windowSpacing = {
        vertical: (height - 2) / (windowRows + 1),
        horizontal: (width - 2) / (windowCols + 1)
      };

      for (let row = 0; row < windowRows; row++) {
        for (let col = 0; col < windowCols; col++) {
          const windowGeometry = new THREE.BoxGeometry(windowSize, windowSize, 0.1);
          const windowMaterial = new THREE.MeshPhongMaterial({
            color: 0xffffcc,
            emissive: 0x666666
          });
          
          const xPos = -width/2 + windowSpacing.horizontal * (col + 1);
          const yPos = -height/2 + windowSpacing.vertical * (row + 1) + 1;
          
          const frontWindow = new THREE.Mesh(windowGeometry, windowMaterial);
          frontWindow.position.set(xPos, yPos, depth/2 + 0.1);
          buildingGroup.add(frontWindow);
          
          const backWindow = new THREE.Mesh(windowGeometry, windowMaterial);
          backWindow.position.set(xPos, yPos, -depth/2 - 0.1);
          buildingGroup.add(backWindow);
          
          const sideWindow1 = new THREE.Mesh(windowGeometry, windowMaterial);
          sideWindow1.rotation.y = Math.PI/2;
          sideWindow1.position.set(width/2 + 0.1, yPos, xPos);
          buildingGroup.add(sideWindow1);
          
          const sideWindow2 = new THREE.Mesh(windowGeometry, windowMaterial);
          sideWindow2.rotation.y = Math.PI/2;
          sideWindow2.position.set(-width/2 - 0.1, yPos, xPos);
          buildingGroup.add(sideWindow2);
        }
      }

      buildingGroup.add(buildingMesh);
      buildingGroup.position.set(pos.x, height/2, pos.z);
      this.scene.add(buildingGroup);

      const shape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, depth/2));
      const body = new CANNON.Body({
        mass: width * height * 2,
        shape: shape,
        position: new CANNON.Vec3(pos.x, height/2, pos.z)
      });
      this.world.addBody(body);

      objects.push({ mesh: buildingGroup, body });
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
      0xFF0000, 
      0x00FF00, 
      0x0000FF, 
      0xFFFF00, 
      0xFF00FF, 
      0x00FFFF, 
      0xFFA500, 
      0x800080  
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }

  getRandomBuildingColor() {
    const colors = [
      0x808080, 
      0x606060, 
      0xa0a0a0, 
      0x8b4513, 
      0x4a4a4a, 
      0xd3d3d3  
    ];
    return colors[Math.floor(Math.random() * colors.length)];
  }
}
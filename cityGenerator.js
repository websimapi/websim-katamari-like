export class CityGenerator {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.chunkSize = 100;
    this.loadedChunks = new Set();
    this.objects = new Map();
    this.minObjectSize = 0.2;   // Minimum size for collectibles
    this.maxObjectSize = 15;    // Maximum size for buildings
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
    const occupiedSpaces = new Set();
    
    // Function to check if a position is too close to existing objects
    const isSpaceOccupied = (x, z, size) => {
      const gridSize = Math.ceil(size);
      for (let dx = -gridSize; dx <= gridSize; dx++) {
        for (let dz = -gridSize; dz <= gridSize; dz++) {
          const key = `${Math.round((x + dx)/2)},${Math.round((z + dz)/2)}`;
          if (occupiedSpaces.has(key)) return true;
        }
      }
      
      for (let dx = -gridSize; dx <= gridSize; dx++) {
        for (let dz = -gridSize; dz <= gridSize; dz++) {
          const key = `${Math.round((x + dx)/2)},${Math.round((z + dz)/2)}`;
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

    const objectCounts = {
      tiny: 25,
      medium: 15,
      large: 5,
      buildings: 6
    };

    const geometryPool = {
      sphere: new THREE.IcosahedronGeometry(1, 0),
      box: new THREE.BoxGeometry(1, 1, 1),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 6)
    };

    const materialPool = new Map();
    const getMaterial = (color) => {
      if (!materialPool.has(color)) {
        materialPool.set(color, new THREE.MeshPhongMaterial({ 
          color, 
          flatShading: true 
        }));
      }
      return materialPool.get(color);
    };

    const createWindows = (width, height) => {
      const windowGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.1);
      const windowMaterial = getMaterial(0x88CCFF);
      const windowGroup = new THREE.Group();
      const spacing = 2;
      for (let y = 1; y < height - 1; y += spacing) {
        for (let x = -width/2 + 1; x < width/2; x += spacing) {
          if (Math.random() < 0.5) {
            const windowPane = new THREE.Mesh(windowGeometry, windowMaterial);
            windowPane.position.set(x, y, width/2 + 0.1);
            windowGroup.add(windowPane);
          }
        }
      }
      return windowGroup;
    };

    // Generate tiny collectibles
    for (let i = 0; i < objectCounts.tiny; i++) {  
      const size = this.minObjectSize + Math.random() * 0.3;
      const pos = getValidPosition(size);
      if (!pos) continue;
      
      let mesh;
      if (Math.random() < 0.5) {
        const geometry = geometryPool.box.clone();
        geometry.scale(size * 2, size * 2, size * 2);
        const material = getMaterial(0xFFFFFF);
        mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = Math.random() * Math.PI;
        mesh.rotation.y = Math.random() * Math.PI;
        mesh.userData.itemName = "Paper";
      } else {
        const geometry = geometryPool.sphere.clone();
        geometry.scale(size, size, size);
        const material = getMaterial(this.getRandomColor());
        mesh = new THREE.Mesh(geometry, material);
        mesh.userData.itemName = "Crumpled Paper Ball";
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

    // Generate medium collectibles
    for (let i = 0; i < objectCounts.medium; i++) {  
      const size = 0.5 + Math.random() * 2;
      const pos = getValidPosition(size);
      if (!pos) continue;
      
      let mesh;
      if (Math.random() < 0.5) {
        const group = new THREE.Group();
        const bodyGeometry = geometryPool.cylinder.clone();
        bodyGeometry.scale(size/2, size, size/2);
        const bodyMaterial = getMaterial(this.getRandomColor());
        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        group.add(bodyMesh);
        const rimGeometry = geometryPool.cylinder.clone();
        rimGeometry.scale(size/2 * 1.1, size/10, size/2 * 1.1);
        const rim = new THREE.Mesh(rimGeometry, bodyMaterial);
        rim.position.y = size/2;
        group.add(rim);
        mesh = group;
        mesh.userData.itemName = "Trash Bin";
      } else {
        const group = new THREE.Group();
        const boxGeometry = geometryPool.box.clone();
        boxGeometry.scale(size, size, size);
        const boxMaterial = getMaterial(this.getRandomColor());
        const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        group.add(boxMesh);
        const edgeGeometry = geometryPool.box.clone();
        edgeGeometry.scale(size * 1.1, size/10, size * 1.1);
        const edgeMaterial = getMaterial(0x333333);
        const topEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
        topEdge.position.y = size/2;
        group.add(topEdge);
        mesh = group;
        mesh.userData.itemName = "Box";
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

    // Generate large objects
    for (let i = 0; i < objectCounts.large; i++) {
      const size = 2 + Math.random() * 3;
      const pos = getValidPosition(size * 2);
      if (!pos) continue;
      
      const group = new THREE.Group();
      
      if (Math.random() < 0.5) {
        const bodyGeometry = geometryPool.box.clone();
        bodyGeometry.scale(size * 2, size * 0.8, size * 1.5);
        const bodyMaterial = getMaterial(this.getRandomColor());
        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        group.add(bodyMesh);
        const cabinGeometry = geometryPool.box.clone();
        cabinGeometry.scale(size * 1.2, size * 0.6, size);
        const cabin = new THREE.Mesh(cabinGeometry, bodyMaterial);
        cabin.position.y = size * 0.7;
        cabin.position.z = -size * 0.2;
        group.add(cabin);
        const wheelGeometry = geometryPool.cylinder.clone();
        wheelGeometry.scale(size * 0.3, size * 0.2, size * 0.3);
        const wheelMaterial = getMaterial(0x333333);
        for (let w = 0; w < 4; w++) {
          const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
          wheel.rotation.z = Math.PI/2;
          wheel.position.x = (w < 2 ? 1 : -1) * size * 0.8;
          wheel.position.z = (w % 2 ? 1 : -1) * size * 0.5;
          wheel.position.y = -size * 0.3;
          group.add(wheel);
        }
        group.userData.itemName = "Car";
      } else {
        const levels = 2 + Math.floor(Math.random() * 3);
        for (let l = 0; l < levels; l++) {
          const levelGeometry = geometryPool.box.clone();
          levelGeometry.scale(size * (1 - l * 0.2), size, size * (1 - l * 0.2));
          const levelMaterial = getMaterial(0x808080);
          const level = new THREE.Mesh(levelGeometry, levelMaterial);
          level.position.y = l * size;
          group.add(level);
        }
        group.userData.itemName = "Structure";
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
    for (let i = 0; i < objectCounts.buildings; i++) {  
      const width = 3 + Math.random() * 5;   
      const height = 6 + Math.random() * 14;
      const size = Math.max(width, height);
      
      const pos = getValidPosition(width);
      if (!pos) continue;
      
      const group = new THREE.Group();
      
      const buildingGeometry = geometryPool.box.clone();
      buildingGeometry.scale(width, height, width);
      const buildingMaterial = getMaterial(0x808080);
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
      group.add(building);
      
      const windows = createWindows(width, height);
      group.add(windows);
      
      const roofDetail = new THREE.Mesh(
        geometryPool.box.clone(),
        buildingMaterial
      );
      roofDetail.scale.set(width * 0.7, height * 0.1, width * 0.7);
      roofDetail.position.y = height/2 + height * 0.05;
      group.add(roofDetail);
      
      group.position.set(pos.x, height/2, pos.z);
      group.userData.itemName = "Building";
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
        if (obj.mesh.geometry) obj.mesh.geometry.dispose();
        if (obj.mesh.material) {
          if (Array.isArray(obj.mesh.material)) {
            obj.mesh.material.forEach(m => m.dispose());
          } else {
            obj.mesh.material.dispose();
          }
        }
        this.scene.remove(obj.mesh);
        this.world.removeBody(obj.body);
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
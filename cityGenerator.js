import { FlyingCreature } from './flyingCreatures.js';

export class CityGenerator {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.chunkSize = 100;
    this.loadedChunks = new Set();
    // Map structure: key -> { ground: Array of ground objects, flying: Array of flying creatures }
    this.objects = new Map();
    this.minObjectSize = 0.2;   // Minimum size for collectibles
    this.maxObjectSize = 15;    // Maximum size for buildings
    
    this.setupCommonMaterials();
  }

  setupCommonMaterials() {
    this.materials = {
      wood: new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, metalness: 0.1 }),
      leaves: new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8, metalness: 0.0 }),
      stone: new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.6, metalness: 0.2 }),
      metal: new THREE.MeshStandardMaterial({ color: 0xAAAAAA, roughness: 0.3, metalness: 0.8 }),
      emissive: new THREE.MeshStandardMaterial({ color: 0xFFFFE0, emissive: 0xFFFFE0, emissiveIntensity: 2.0 }),
      plastic: new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.4, metalness: 0.1 })
    };
  }

  update(playerPosition) {
    if (!playerPosition) return;
    
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
    // Create separate arrays for ground objects and flying creatures.
    const groundObjects = [];
    const flyingCreatures = [];
    const occupiedSpaces = new Set();

    // Seeded random generator based on chunk coordinates.
    // Using a simple LCG: seedValue will be updated every call to r()
    let seedValue = (((chunk.x + 1000) * 10000) + (chunk.z + 1000)) % 233280;
    function r() {
      seedValue = (seedValue * 9301 + 49297) % 233280;
      return seedValue / 233280;
    }

    // Seeded version for color selection
    const seededGetRandomColor = () => {
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
      return colors[Math.floor(r() * colors.length)];
    };

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
        x = (chunk.x * this.chunkSize) + (size * 2) + r() * (this.chunkSize - size * 4);
        z = (chunk.z * this.chunkSize) + (size * 2) + r() * (this.chunkSize - size * 4);
        attempts++;
      } while (isSpaceOccupied(x, z, size) && attempts < 50);
      
      return attempts < 50 ? { x, z } : null;
    };

    // Updated object counts to add more variety.
    const objectCounts = {
      tiny: 50,
      medium: 30,
      large: 10,
      buildings: 8
    };

    const geometryPool = {
      sphere: new THREE.IcosahedronGeometry(1, 0),
      box: new THREE.BoxGeometry(1, 1, 1),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 6)
    };

    const materialPool = new Map();
    const getMaterial = (color) => {
      if (!materialPool.has(color)) {
        materialPool.set(color, new THREE.MeshStandardMaterial({ 
          color, 
          roughness: 0.5,
          metalness: 0.2
        }));
      }
      return materialPool.get(color);
    };

    const createWindows = (width, height) => {
      const windowGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.1);
      const windowMaterial = this.materials.emissive;
      const windowGroup = new THREE.Group();
      const spacing = 2;
      for (let y = 2; y < height - 1; y += spacing) {
        for (let x = -width/2 + 1; x < width/2; x += spacing) {
          if (r() < 0.6) { // More windows lit
            const windowPane = new THREE.Mesh(windowGeometry, windowMaterial);
            windowPane.position.set(x, y, width/2 + 0.1);
            windowGroup.add(windowPane);
            
            // Add backside windows too
            const windowBack = windowPane.clone();
            windowBack.position.set(x, y, -width/2 - 0.1);
            windowGroup.add(windowBack);
          }
        }
      }
      return windowGroup;
    };
    
    // AAA: Add Trees
    const createTree = (pos, size) => {
        const group = new THREE.Group();
        const trunkH = size * 2;
        const trunkGeo = new THREE.CylinderGeometry(size/4, size/3, trunkH, 6);
        const trunk = new THREE.Mesh(trunkGeo, this.materials.wood);
        trunk.position.y = trunkH/2;
        trunk.castShadow = true;
        trunk.receiveShadow = true;
        group.add(trunk);
        
        const leavesGeo = new THREE.ConeGeometry(size * 1.5, size * 3, 8);
        const leaves = new THREE.Mesh(leavesGeo, this.materials.leaves);
        leaves.position.y = trunkH + size;
        leaves.castShadow = true;
        leaves.receiveShadow = true;
        group.add(leaves);
        
        group.position.set(pos.x, 0, pos.z);
        group.userData.itemName = "Tree";
        
        const shape = new CANNON.Cylinder(size/3, size/4, trunkH, 6);
        // Cannon cylinder orientation fix
        const q = new CANNON.Quaternion();
        q.setFromAxisAngle(new CANNON.Vec3(1,0,0),-Math.PI/2);
        
        const body = new CANNON.Body({
            mass: size * 10,
            shape: shape,
            position: new CANNON.Vec3(pos.x, trunkH/2, pos.z)
        });
        body.quaternion.set(q.x, q.y, q.z, q.w);
        
        return { mesh: group, body };
    };

    // AAA: Add Street Lamps
    const createLamp = (pos, size) => {
        const group = new THREE.Group();
        const poleH = size * 4;
        const poleGeo = new THREE.CylinderGeometry(size/10, size/8, poleH, 6);
        const pole = new THREE.Mesh(poleGeo, this.materials.metal);
        pole.position.y = poleH/2;
        pole.castShadow = true;
        pole.receiveShadow = true;
        group.add(pole);
        
        const bulbGeo = new THREE.SphereGeometry(size/2, 8, 8);
        const bulb = new THREE.Mesh(bulbGeo, this.materials.emissive);
        bulb.position.y = poleH;
        group.add(bulb);
        
        group.position.set(pos.x, 0, pos.z);
        group.userData.itemName = "Street Lamp";
        
        const shape = new CANNON.Cylinder(size/10, size/8, poleH, 6);
         const q = new CANNON.Quaternion();
        q.setFromAxisAngle(new CANNON.Vec3(1,0,0),-Math.PI/2);
        
        const body = new CANNON.Body({
            mass: size * 5,
            shape: shape,
            position: new CANNON.Vec3(pos.x, poleH/2, pos.z)
        });
        body.quaternion.set(q.x, q.y, q.z, q.w);
        
        return { mesh: group, body };
    };

    // Generate tiny collectibles
    for (let i = 0; i < objectCounts.tiny; i++) {  
      const size = this.minObjectSize + r() * 0.3;
      const pos = getValidPosition(size);
      if (!pos) continue;
      
      let mesh;
      if (r() < 0.5) {
        const geometry = geometryPool.box.clone();
        geometry.scale(size * 2, size * 2, size * 2);
        const material = getMaterial(0xFFFFFF);
        mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = r() * Math.PI;
        mesh.rotation.y = r() * Math.PI;
        mesh.userData.itemName = "Paper";
      } else {
        const geometry = geometryPool.sphere.clone();
        geometry.scale(size, size, size);
        const material = getMaterial(seededGetRandomColor());
        mesh = new THREE.Mesh(geometry, material);
        mesh.userData.itemName = "Ball";
      }
      mesh.position.set(pos.x, size, pos.z);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);

      const shape = new CANNON.Sphere(size);
      const body = new CANNON.Body({
        mass: size * 2,
        shape: shape,
        position: new CANNON.Vec3(pos.x, size, pos.z)
      });
      this.world.addBody(body);

      groundObjects.push({ mesh, body });
    }
    
    // Add Natural Elements (Trees, Rocks)
    for (let i = 0; i < 15; i++) {
        const size = 1 + r() * 2;
        const pos = getValidPosition(size);
        if(!pos) continue;
        
        if (r() < 0.7) {
            const tree = createTree(pos, size);
            this.scene.add(tree.mesh);
            this.world.addBody(tree.body);
            groundObjects.push(tree);
        } else {
            // Rock
            const geo = new THREE.DodecahedronGeometry(size, 0);
            const mesh = new THREE.Mesh(geo, this.materials.stone);
            mesh.position.set(pos.x, size/2, pos.z);
            mesh.rotation.set(r(), r(), r());
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            mesh.userData.itemName = "Rock";
            this.scene.add(mesh);
            
            const shape = new CANNON.Sphere(size); // Approximate
            const body = new CANNON.Body({ mass: size * 10, shape, position: new CANNON.Vec3(pos.x, size/2, pos.z) });
            this.world.addBody(body);
            groundObjects.push({ mesh, body });
        }
    }
    
    // Add Lamps
    for (let i = 0; i < 5; i++) {
        const size = 0.5 + r() * 0.5;
        const pos = getValidPosition(size);
        if(!pos) continue;
        const lamp = createLamp(pos, size);
        this.scene.add(lamp.mesh);
        this.world.addBody(lamp.body);
        groundObjects.push(lamp);
    }

    // Generate medium collectibles
    for (let i = 0; i < objectCounts.medium; i++) {  
      const size = 0.5 + r() * 2;
      const pos = getValidPosition(size);
      if (!pos) continue;
      
      let mesh;
      if (r() < 0.5) {
        const group = new THREE.Group();
        const bodyGeometry = geometryPool.cylinder.clone();
        bodyGeometry.scale(size/2, size, size/2);
        const bodyMaterial = getMaterial(seededGetRandomColor());
        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
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
        const boxMaterial = getMaterial(seededGetRandomColor());
        const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
        boxMesh.castShadow = true;
        boxMesh.receiveShadow = true;
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

      groundObjects.push({ mesh, body });
    }

    // Generate large objects
    for (let i = 0; i < objectCounts.large; i++) {
      const size = 2 + r() * 3;
      const pos = getValidPosition(size * 2);
      if (!pos) continue;
      
      const group = new THREE.Group();
      
      if (r() < 0.5) {
        const bodyGeometry = geometryPool.box.clone();
        bodyGeometry.scale(size * 2, size * 0.8, size * 1.5);
        const bodyMaterial = getMaterial(seededGetRandomColor());
        const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
        bodyMesh.castShadow = true;
        bodyMesh.receiveShadow = true;
        group.add(bodyMesh);
        // Car parts
        const cabinGeometry = geometryPool.box.clone();
        cabinGeometry.scale(size * 1.2, size * 0.6, size);
        const cabin = new THREE.Mesh(cabinGeometry, bodyMaterial);
        cabin.position.y = size * 0.7;
        cabin.position.z = -size * 0.2;
        cabin.castShadow = true;
        group.add(cabin);
        // Wheels
        const wheelGeometry = geometryPool.cylinder.clone();
        wheelGeometry.scale(size * 0.3, size * 0.2, size * 0.3);
        const wheelMaterial = getMaterial(0x333333);
        for (let w = 0; w < 4; w++) {
          const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
          wheel.rotation.z = Math.PI/2;
          wheel.position.x = (w < 2 ? 1 : -1) * size * 0.8;
          wheel.position.z = (w % 2 ? 1 : -1) * size * 0.5;
          wheel.position.y = -size * 0.3;
          wheel.castShadow = true;
          group.add(wheel);
        }
        
        group.userData.itemName = "Car";
      } else {
        const levels = 2 + Math.floor(r() * 3);
        for (let l = 0; l < levels; l++) {
          const levelGeometry = geometryPool.box.clone();
          levelGeometry.scale(size * (1 - l * 0.2), size, size * (1 - l * 0.2));
          const levelMaterial = getMaterial(0x808080);
          const level = new THREE.Mesh(levelGeometry, levelMaterial);
          level.position.y = l * size;
          level.castShadow = true;
          level.receiveShadow = true;
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

      groundObjects.push({ mesh: group, body });
    }
    
    // Generate buildings
    for (let i = 0; i < objectCounts.buildings; i++) {  
      const width = 3 + r() * 5;   
      const height = 6 + r() * 14;
      const size = Math.max(width, height);
      
      const pos = getValidPosition(width);
      if (!pos) continue;
      
      const group = new THREE.Group();
      
      const buildingGeometry = geometryPool.box.clone();
      buildingGeometry.scale(width, height, width);
      // Use stone/concrete material
      const buildingMaterial = this.materials.stone;
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
      building.castShadow = true;
      building.receiveShadow = true;
      group.add(building);
      
      const windows = createWindows(width, height);
      group.add(windows);
      
      const roofDetail = new THREE.Mesh(
        geometryPool.box.clone(),
        buildingMaterial
      );
      roofDetail.scale.set(width * 0.7, height * 0.1, width * 0.7);
      roofDetail.position.y = height/2 + height * 0.05;
      roofDetail.castShadow = true;
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

      groundObjects.push({ mesh: group, body });
    }
    
    // Generate flying creatures within this chunk
    const flyingTypes = ['butterfly', 'eagle', 'bee'];
    const flyingCount = 3 + Math.floor(r() * 3);
    for (let i = 0; i < flyingCount; i++) {
      const type = flyingTypes[Math.floor(r() * flyingTypes.length)];
      const x = (chunk.x * this.chunkSize) + r() * this.chunkSize;
      const z = (chunk.z * this.chunkSize) + r() * this.chunkSize;
      const y = 15 + r() * 35;
      const position = new THREE.Vector3(x, y, z);
      const creature = new FlyingCreature(this.scene, type, position);
      flyingCreatures.push(creature);
    }

    const key = `${chunk.x},${chunk.z}`;
    this.objects.set(key, { ground: groundObjects, flying: flyingCreatures });
  }

  removeChunk(chunk) {
    const key = `${chunk.x},${chunk.z}`;
    const chunkData = this.objects.get(key);
    if (chunkData) {
      // Remove ground objects
      chunkData.ground.forEach(obj => {
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
      // Dispose flying creatures
      chunkData.flying.forEach(creature => {
        creature.dispose();
      });
      this.objects.delete(key);
    }
  }

  removeObjectByBodyId(bodyId) {
    if (!bodyId) return;
    
    this.objects.forEach((chunkData, key) => {
      if (!chunkData || !chunkData.ground) return;
      
      for (let i = chunkData.ground.length - 1; i >= 0; i--) {
        const obj = chunkData.ground[i];
        if (!obj || !obj.body) continue;
        
        if (obj.body.id === bodyId) {
          if (obj.mesh) {
            if (obj.mesh.geometry) obj.mesh.geometry.dispose();
            if (obj.mesh.material) {
              if (Array.isArray(obj.mesh.material)) {
                obj.mesh.material.forEach(mat => mat && mat.dispose());
              } else if (obj.mesh.material) {
                obj.mesh.material.dispose();
              }
            }
            this.scene.remove(obj.mesh);
          }
          if (obj.body) {
            this.world.removeBody(obj.body);
          }
          chunkData.ground.splice(i, 1);
          // Found and removed, exit the loop.
          return;
        }
      }
    });
  }

  getRandomColor() {
    // Fallback method if needed outside seeded context
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
}
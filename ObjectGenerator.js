export class ObjectGenerator {
  constructor(scene, world, biomeManager) {
    this.scene = scene;
    this.world = world;
    this.biomeManager = biomeManager;
    
    this.minObjectSize = 0.2;   // Minimum size for collectibles
    this.maxObjectSize = 15;    // Maximum size for buildings
    
    // Pool for geometry and materials to improve performance
    this.geometryPool = {
      sphere: new THREE.IcosahedronGeometry(1, 0),
      box: new THREE.BoxGeometry(1, 1, 1),
      cylinder: new THREE.CylinderGeometry(1, 1, 1, 6)
    };
    
    this.materialPool = new Map();
  }
  
  getMaterial(color) {
    if (!this.materialPool.has(color)) {
      this.materialPool.set(color, new THREE.MeshPhongMaterial({ 
        color, 
        flatShading: true 
      }));
    }
    return this.materialPool.get(color);
  }

  // Helper for creating windows on buildings
  createWindows(width, height) {
    const windowGeometry = this.geometryPool.box.clone();
    windowGeometry.scale(0.3, 0.3, 0.1);
    const windowMaterial = this.getMaterial(0x88CCFF);
    const windowGroup = new THREE.Group();
    const spacing = 2;
    
    for (let y = 1; y < height - 1; y += spacing) {
      for (let x = -width/2 + 1; x < width/2; x += spacing) {
        // Random chance to place a window
        if (Math.random() < 0.5) {
          const windowPane = new THREE.Mesh(windowGeometry, windowMaterial);
          windowPane.position.set(x, y, width/2 + 0.1);
          windowGroup.add(windowPane);
        }
      }
    }
    return windowGroup;
  }

  // Returns random color from biome's palette
  getRandomColorForBiome(biome, r) {
    const colors = biome.objectColors;
    return colors[Math.floor(r() * colors.length)];
  }

  // Generate all objects for a chunk
  generateChunkObjects(chunk, biome, terrainChunk, r) {
    const groundObjects = [];
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

    const getValidPosition = (size, chunkSize) => {
      let attempts = 0;
      let x, z;
      do {
        x = (chunk.x * chunkSize) + (size * 2) + r() * (chunkSize - size * 4);
        z = (chunk.z * chunkSize) + (size * 2) + r() * (chunkSize - size * 4);
        attempts++;
      } while (isSpaceOccupied(x, z, size) && attempts < 50);
      
      return attempts < 50 ? { x, z } : null;
    };
    
    // Use biome-specific object counts
    const objectCounts = biome.objects;
    
    // Generate tiny collectibles
    this.generateTinyObjects(chunk, biome, terrainChunk, objectCounts.tiny, r, getValidPosition, groundObjects);
    
    // Generate medium objects
    this.generateMediumObjects(chunk, biome, terrainChunk, objectCounts.medium, r, getValidPosition, groundObjects);
    
    // Generate large objects
    this.generateLargeObjects(chunk, biome, terrainChunk, objectCounts.large, r, getValidPosition, groundObjects);
    
    // Generate buildings
    this.generateBuildings(chunk, biome, terrainChunk, objectCounts.buildings, r, getValidPosition, groundObjects);
    
    return groundObjects;
  }
  
  // Generate small collectible objects
  generateTinyObjects(chunk, biome, terrainChunk, count, r, getValidPosition, groundObjects) {
    const chunkSize = terrainChunk.chunkSize;
    
    for (let i = 0; i < count; i++) {  
      const size = this.minObjectSize + r() * 0.3;
      const pos = getValidPosition(size, chunkSize);
      if (!pos) continue;
      
      // Get terrain height at this position
      const terrainHeight = terrainChunk.getHeightAt(pos.x, pos.z);
      
      let mesh;
      if (r() < 0.5) {
        const geometry = this.geometryPool.box.clone();
        geometry.scale(size * 2, size * 2, size * 2);
        const material = this.getMaterial(this.getRandomColorForBiome(biome, r));
        mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = r() * Math.PI;
        mesh.rotation.y = r() * Math.PI;
        
        if (biome === this.biomeManager.biomes.CITY) {
          mesh.userData.itemName = "Paper";
        } else if (biome === this.biomeManager.biomes.FOREST) {
          mesh.userData.itemName = "Leaf";
        } else if (biome === this.biomeManager.biomes.DESERT) {
          mesh.userData.itemName = "Stone";
        } else if (biome === this.biomeManager.biomes.MOUNTAINS) {
          mesh.userData.itemName = "Rock";
        } else if (biome === this.biomeManager.biomes.SNOW) {
          mesh.userData.itemName = "Snowball";
        }
      } else {
        const geometry = this.geometryPool.sphere.clone();
        geometry.scale(size, size, size);
        const material = this.getMaterial(this.getRandomColorForBiome(biome, r));
        mesh = new THREE.Mesh(geometry, material);
        
        if (biome === this.biomeManager.biomes.CITY) {
          mesh.userData.itemName = "Crumpled Paper Ball";
        } else if (biome === this.biomeManager.biomes.FOREST) {
          mesh.userData.itemName = "Berry";
        } else if (biome === this.biomeManager.biomes.DESERT) {
          mesh.userData.itemName = "Pebble";
        } else if (biome === this.biomeManager.biomes.MOUNTAINS) {
          mesh.userData.itemName = "Ore";
        } else if (biome === this.biomeManager.biomes.SNOW) {
          mesh.userData.itemName = "Ice Crystal";
        }
      }
      
      // Position on top of terrain
      mesh.position.set(pos.x, terrainHeight + size, pos.z);
      this.scene.add(mesh);

      const shape = new CANNON.Sphere(size);
      const body = new CANNON.Body({
        mass: size * 2,
        shape: shape,
        position: new CANNON.Vec3(pos.x, terrainHeight + size, pos.z)
      });
      this.world.addBody(body);

      groundObjects.push({ mesh, body });
    }
  }
  
  // Generate medium-sized objects with biome-specific variations
  generateMediumObjects(chunk, biome, terrainChunk, count, r, getValidPosition, groundObjects) {
    const chunkSize = terrainChunk.chunkSize;
    
    for (let i = 0; i < count; i++) {  
      const size = 0.5 + r() * 2;
      const pos = getValidPosition(size, chunkSize);
      if (!pos) continue;
      
      // Get terrain height at this position
      const terrainHeight = terrainChunk.getHeightAt(pos.x, pos.z);
      
      let mesh;
      let itemName = "Item";
      
      if (biome === this.biomeManager.biomes.CITY) {
        if (r() < 0.5) {
          // Trash bin
          const group = new THREE.Group();
          const bodyGeometry = this.geometryPool.cylinder.clone();
          bodyGeometry.scale(size/2, size, size/2);
          const bodyMaterial = this.getMaterial(this.getRandomColorForBiome(biome, r));
          const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
          group.add(bodyMesh);
          const rimGeometry = this.geometryPool.cylinder.clone();
          rimGeometry.scale(size/2 * 1.1, size/10, size/2 * 1.1);
          const rim = new THREE.Mesh(rimGeometry, bodyMaterial);
          rim.position.y = size/2;
          group.add(rim);
          mesh = group;
          itemName = "Trash Bin";
        } else {
          // Box
          const group = new THREE.Group();
          const boxGeometry = this.geometryPool.box.clone();
          boxGeometry.scale(size, size, size);
          const boxMaterial = this.getMaterial(this.getRandomColorForBiome(biome, r));
          const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
          group.add(boxMesh);
          const edgeGeometry = this.geometryPool.box.clone();
          edgeGeometry.scale(size * 1.1, size/10, size * 1.1);
          const edgeMaterial = this.getMaterial(0x333333);
          const topEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
          topEdge.position.y = size/2;
          group.add(topEdge);
          mesh = group;
          itemName = "Box";
        }
      } else if (biome === this.biomeManager.biomes.FOREST) {
        // Forest medium objects (bush or stump)
        mesh = this.generateForestMediumObject(size, r, itemName);
        itemName = mesh.userData.itemName; // Get the name set inside the function
      } else if (biome === this.biomeManager.biomes.DESERT) {
        // Desert medium objects (cactus or rock formation)
        mesh = this.generateDesertMediumObject(size, r, itemName);
        itemName = mesh.userData.itemName;
      } else if (biome === this.biomeManager.biomes.MOUNTAINS) {
        // Mountain medium objects (boulder or crystal)
        mesh = this.generateMountainMediumObject(size, r, itemName);
        itemName = mesh.userData.itemName;
      } else if (biome === this.biomeManager.biomes.SNOW) {
        // Snow medium objects (snowdrift or ice block)
        mesh = this.generateSnowMediumObject(size, r, itemName);
        itemName = mesh.userData.itemName;
      }
      
      mesh.userData.itemName = itemName;
      mesh.position.set(pos.x, terrainHeight + size/2, pos.z);
      this.scene.add(mesh);

      const shape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2));
      const body = new CANNON.Body({
        mass: size * 3,
        shape: shape,
        position: new CANNON.Vec3(pos.x, terrainHeight + size/2, pos.z)
      });
      this.world.addBody(body);

      groundObjects.push({ mesh, body });
    }
  }
  
  // Generate forest medium objects (separated for clarity)
  generateForestMediumObject(size, r, itemName) {
    const group = new THREE.Group();
    
    if (r() < 0.5) {
      // Bush
      for (let j = 0; j < 5; j++) {
        const leafGeometry = this.geometryPool.sphere.clone();
        const scale = 0.5 + r() * 0.5;
        leafGeometry.scale(size * scale, size * scale, size * scale);
        const leafMaterial = this.getMaterial(0x228B22);
        const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
        leaf.position.set(
          (r() - 0.5) * size,
          (r() - 0.5) * size + size/2,
          (r() - 0.5) * size
        );
        group.add(leaf);
      }
      group.userData = { itemName: "Bush" };
    } else {
      // Stump
      const trunkGeometry = this.geometryPool.cylinder.clone();
      trunkGeometry.scale(size/2, size/2, size/2);
      const trunkMaterial = this.getMaterial(0x8B4513);
      const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
      trunk.position.y = -size/4;
      group.add(trunk);
      const topGeometry = this.geometryPool.cylinder.clone();
      topGeometry.scale(size/1.8, size/10, size/1.8);
      const top = new THREE.Mesh(topGeometry, trunkMaterial);
      group.add(top);
      group.userData = { itemName: "Tree Stump" };
    }
    
    return group;
  }
  
  // Generate desert medium objects
  generateDesertMediumObject(size, r, itemName) {
    const group = new THREE.Group();
    
    if (r() < 0.5) {
      // Cactus
      const bodyGeometry = this.geometryPool.cylinder.clone();
      bodyGeometry.scale(size/4, size, size/4);
      const bodyMaterial = this.getMaterial(0x2F4F4F);
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      group.add(body);
      
      if (r() < 0.7) {
        const armGeometry = this.geometryPool.cylinder.clone();
        armGeometry.scale(size/6, size/2, size/6);
        const arm = new THREE.Mesh(armGeometry, bodyMaterial);
        arm.rotation.z = Math.PI / 4;
        arm.position.set(size/2, size/4, 0);
        group.add(arm);
      }
      
      group.userData = { itemName: "Cactus" };
    } else {
      // Rock formation
      for (let j = 0; j < 3; j++) {
        const rockGeometry = this.geometryPool.sphere.clone();
        const scale = 0.5 + r() * 0.5;
        rockGeometry.scale(size * scale, size * scale * 0.7, size * scale);
        const rockMaterial = this.getMaterial(0xAA8866);
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.set(
          (r() - 0.5) * size,
          (r() * 0.5) * size,
          (r() - 0.5) * size
        );
        rock.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
        group.add(rock);
      }
      group.userData = { itemName: "Rock Formation" };
    }
    
    return group;
  }
  
  // Generate mountain medium objects
  generateMountainMediumObject(size, r, itemName) {
    const group = new THREE.Group();
    
    if (r() < 0.5) {
      // Boulder
      const baseGeometry = this.geometryPool.sphere.clone();
      baseGeometry.scale(size, size * 0.8, size);
      const material = this.getMaterial(0x808080);
      const base = new THREE.Mesh(baseGeometry, material);
      group.add(base);
      
      // Add some detail to the boulder
      for (let j = 0; j < 3; j++) {
        const detailGeometry = this.geometryPool.sphere.clone();
        const scale = 0.3 + r() * 0.2;
        detailGeometry.scale(size * scale, size * scale, size * scale);
        const detail = new THREE.Mesh(detailGeometry, material);
        detail.position.set(
          (r() - 0.5) * size,
          (r() * 0.5) * size,
          (r() - 0.5) * size
        );
        group.add(detail);
      }
      
      group.userData = { itemName: "Boulder" };
    } else {
      // Crystal formation
      for (let j = 0; j < 5; j++) {
        const crystalGeometry = this.geometryPool.box.clone();
        const scale = 0.3 + r() * 0.3;
        crystalGeometry.scale(size * scale * 0.3, size * scale, size * scale * 0.3);
        const crystalMaterial = this.getMaterial(0x8888FF);
        const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
        crystal.position.set(
          (r() - 0.5) * size * 0.7,
          (r() * 0.5) * size,
          (r() - 0.5) * size * 0.7
        );
        crystal.rotation.set(0, r() * Math.PI * 2, r() * Math.PI / 6);
        group.add(crystal);
      }
      group.userData = { itemName: "Crystal Formation" };
    }
    
    return group;
  }
  
  // Generate snow medium objects
  generateSnowMediumObject(size, r, itemName) {
    const group = new THREE.Group();
    
    if (r() < 0.5) {
      // Snowdrift
      for (let j = 0; j < 3; j++) {
        const snowGeometry = this.geometryPool.sphere.clone();
        const scale = 0.5 + r() * 0.5;
        snowGeometry.scale(size * scale, size * scale * 0.6, size * scale);
        const snowMaterial = this.getMaterial(0xFFFFFF);
        const snow = new THREE.Mesh(snowGeometry, snowMaterial);
        snow.position.set(
          (r() - 0.5) * size,
          (r() * 0.3) * size,
          (r() - 0.5) * size
        );
        group.add(snow);
      }
      group.userData = { itemName: "Snowdrift" };
    } else {
      // Ice block
      const iceGeometry = this.geometryPool.box.clone();
      iceGeometry.scale(size, size, size);
      const iceMaterial = new THREE.MeshPhongMaterial({
        color: 0xAADDFF,
        transparent: true,
        opacity: 0.8,
        shininess: 90
      });
      const ice = new THREE.Mesh(iceGeometry, iceMaterial);
      group.add(ice);
      
      group.userData = { itemName: "Ice Block" };
    }
    
    return group;
  }
  
  // Generate large objects based on biome
  generateLargeObjects(chunk, biome, terrainChunk, count, r, getValidPosition, groundObjects) {
    const chunkSize = terrainChunk.chunkSize;
    
    for (let i = 0; i < count; i++) {
      const size = 2 + r() * 3;
      const pos = getValidPosition(size * 2, chunkSize);
      if (!pos) continue;
      
      // Get terrain height at this position
      const terrainHeight = terrainChunk.getHeightAt(pos.x, pos.z);
      
      let group, itemName;
      
      if (biome === this.biomeManager.biomes.CITY) {
        [group, itemName] = this.generateCityLargeObject(size, r);
      } else if (biome === this.biomeManager.biomes.FOREST) {
        [group, itemName] = this.generateForestLargeObject(size, r);
      } else if (biome === this.biomeManager.biomes.DESERT) {
        [group, itemName] = this.generateDesertLargeObject(size, r);
      } else if (biome === this.biomeManager.biomes.MOUNTAINS) {
        [group, itemName] = this.generateMountainLargeObject(size, r);
      } else if (biome === this.biomeManager.biomes.SNOW) {
        [group, itemName] = this.generateSnowLargeObject(size, r);
      }
      
      group.userData.itemName = itemName;
      group.position.set(pos.x, terrainHeight + size/2, pos.z);
      this.scene.add(group);

      const shape = new CANNON.Box(new CANNON.Vec3(size, size/2, size * 0.75));
      const body = new CANNON.Body({
        mass: size * 10,
        shape: shape,
        position: new CANNON.Vec3(pos.x, terrainHeight + size/2, pos.z)
      });
      this.world.addBody(body);

      groundObjects.push({ mesh: group, body });
    }
  }
  
  // Generate city large objects (car or structure)
  generateCityLargeObject(size, r) {
    const group = new THREE.Group();
    let itemName;
    
    if (r() < 0.5) {
      // Car
      const bodyGeometry = this.geometryPool.box.clone();
      bodyGeometry.scale(size * 2, size * 0.8, size * 1.5);
      const bodyMaterial = this.getMaterial(Math.floor(Math.random() * 0xFFFFFF));
      const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
      group.add(bodyMesh);
      
      const cabinGeometry = this.geometryPool.box.clone();
      cabinGeometry.scale(size * 1.2, size * 0.6, size);
      const cabin = new THREE.Mesh(cabinGeometry, bodyMaterial);
      cabin.position.y = size * 0.7;
      cabin.position.z = -size * 0.2;
      group.add(cabin);
      
      const wheelGeometry = this.geometryPool.cylinder.clone();
      wheelGeometry.scale(size * 0.3, size * 0.2, size * 0.3);
      const wheelMaterial = this.getMaterial(0x333333);
      for (let w = 0; w < 4; w++) {
        const wheel = new THREE.Mesh(wheelGeometry, wheelMaterial);
        wheel.rotation.z = Math.PI/2;
        wheel.position.x = (w < 2 ? 1 : -1) * size * 0.8;
        wheel.position.z = (w % 2 ? 1 : -1) * size * 0.5;
        wheel.position.y = -size * 0.3;
        group.add(wheel);
      }
      itemName = "Car";
    } else {
      // Structure
      const levels = 2 + Math.floor(r() * 3);
      for (let l = 0; l < levels; l++) {
        const levelGeometry = this.geometryPool.box.clone();
        levelGeometry.scale(size * (1 - l * 0.2), size, size * (1 - l * 0.2));
        const levelMaterial = this.getMaterial(0x808080);
        const level = new THREE.Mesh(levelGeometry, levelMaterial);
        level.position.y = l * size;
        group.add(level);
      }
      itemName = "Structure";
    }
    
    return [group, itemName];
  }
  
  // Generate forest large objects (trees)
  generateForestLargeObject(size, r) {
    const group = new THREE.Group();
    
    // Tree
    const trunkGeometry = this.geometryPool.cylinder.clone();
    trunkGeometry.scale(size * 0.3, size * 1.8, size * 0.3);
    const trunkMaterial = this.getMaterial(0x8B4513);
    const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
    trunk.position.y = size * 0.9;
    group.add(trunk);
    
    // Foliage
    const foliageGeometry = this.geometryPool.sphere.clone();
    foliageGeometry.scale(size * 1.2, size, size * 1.2);
    const foliageMaterial = this.getMaterial(0x228B22);
    const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
    foliage.position.y = size * 2.2;
    group.add(foliage);
    
    return [group, "Tree"];
  }
  
  // Generate desert large objects
  generateDesertLargeObject(size, r) {
    const group = new THREE.Group();
    let itemName;
    
    if (r() < 0.3) {
      // Large cactus
      const mainStemGeometry = this.geometryPool.cylinder.clone();
      mainStemGeometry.scale(size * 0.4, size * 2, size * 0.4);
      const stemMaterial = this.getMaterial(0x2F4F4F);
      const mainStem = new THREE.Mesh(mainStemGeometry, stemMaterial);
      mainStem.position.y = size;
      group.add(mainStem);
      
      // Arms
      const numArms = 1 + Math.floor(r() * 3);
      for (let a = 0; a < numArms; a++) {
        const armGeometry = this.geometryPool.cylinder.clone();
        armGeometry.scale(size * 0.3, size, size * 0.3);
        const arm = new THREE.Mesh(armGeometry, stemMaterial);
        const angle = r() * Math.PI * 2;
        const height = size * (0.5 + r() * 0.5);
        arm.position.set(
          Math.cos(angle) * size * 0.4,
          height,
          Math.sin(angle) * size * 0.4
        );
        arm.rotation.z = Math.PI / 3 * (r() > 0.5 ? 1 : -1);
        arm.rotation.y = angle;
        group.add(arm);
      }
      
      itemName = "Giant Cactus";
    } else {
      // Mesa
      const levels = 2 + Math.floor(r() * 3);
      const baseColor = 0xAA8866;
      for (let l = 0; l < levels; l++) {
        const levelGeometry = this.geometryPool.box.clone();
        const levelScale = 1 - (l / levels) * 0.6;
        levelGeometry.scale(size * 1.5 * levelScale, size * 0.5, size * 1.5 * levelScale);
        // Slightly vary the color of each level
        const levelColor = new THREE.Color(baseColor).offsetHSL(0, 0, (r() - 0.5) * 0.1);
        const levelMaterial = this.getMaterial(levelColor.getHex());
        const level = new THREE.Mesh(levelGeometry, levelMaterial);
        level.position.y = l * size * 0.5;
        group.add(level);
      }
      
      itemName = "Mesa";
    }
    
    return [group, itemName];
  }
  
  // Generate mountain large objects
  generateMountainLargeObject(size, r) {
    const group = new THREE.Group();
    
    // Mountain peak
    const peakGeometry = this.geometryPool.cylinder.clone();
    peakGeometry.scale(size * 1.5, size * 2, size * 1.5);
    const peakMaterial = this.getMaterial(0x808080);
    const base = new THREE.Mesh(peakGeometry, peakMaterial);
    base.position.y = size;
    group.add(base);
    
    const topGeometry = this.geometryPool.cylinder.clone();
    topGeometry.scale(size * 0.8, size, size * 0.8);
    const top = new THREE.Mesh(topGeometry, peakMaterial);
    top.position.y = size * 2.5;
    group.add(top);
    
    // Snow cap
    const snowGeometry = this.geometryPool.cylinder.clone();
    snowGeometry.scale(size * 0.85, size * 0.2, size * 0.85);
    const snowMaterial = this.getMaterial(0xFFFFFF);
    const snow = new THREE.Mesh(snowGeometry, snowMaterial);
    snow.position.y = size * 3;
    group.add(snow);
    
    return [group, "Mountain Peak"];
  }
  
  // Generate snow large objects
  generateSnowLargeObject(size, r) {
    const group = new THREE.Group();
    let itemName;
    
    if (r() < 0.5) {
      // Snowman
      const bodyGeometry = this.geometryPool.sphere.clone();
      bodyGeometry.scale(size, size, size);
      const bodyMaterial = this.getMaterial(0xFFFFFF);
      const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
      body.position.y = size;
      group.add(body);
      
      const middleGeometry = this.geometryPool.sphere.clone();
      middleGeometry.scale(size * 0.7, size * 0.7, size * 0.7);
      const middle = new THREE.Mesh(middleGeometry, bodyMaterial);
      middle.position.y = size * 2.3;
      group.add(middle);
      
      const headGeometry = this.geometryPool.sphere.clone();
      headGeometry.scale(size * 0.5, size * 0.5, size * 0.5);
      const head = new THREE.Mesh(headGeometry, bodyMaterial);
      head.position.y = size * 3.2;
      group.add(head);
      
      // Eyes and nose
      const eyeGeometry = this.geometryPool.sphere.clone();
      eyeGeometry.scale(size * 0.08, size * 0.08, size * 0.08);
      const eyeMaterial = this.getMaterial(0x000000);
      const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      leftEye.position.set(-size * 0.2, size * 3.3, size * 0.4);
      group.add(leftEye);
      
      const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
      rightEye.position.set(size * 0.2, size * 3.3, size * 0.4);
      group.add(rightEye);
      
      const noseGeometry = this.geometryPool.cylinder.clone();
      noseGeometry.scale(size * 0.05, size * 0.3, size * 0.05);
      const noseMaterial = this.getMaterial(0xFF6600);
      const nose = new THREE.Mesh(noseGeometry, noseMaterial);
      nose.position.set(0, size * 3.2, size * 0.6);
      nose.rotation.x = Math.PI / 2;
      group.add(nose);
      
      itemName = "Snowman";
    } else {
      // Ice sculpture
      const baseGeometry = this.geometryPool.box.clone();
      baseGeometry.scale(size * 1.5, size * 0.5, size * 1.5);
      const iceMaterial = new THREE.MeshPhongMaterial({
        color: 0xCCEEFF,
        transparent: true,
        opacity: 0.7,
        shininess: 100
      });
      const base = new THREE.Mesh(baseGeometry, iceMaterial);
      base.position.y = size * 0.25;
      group.add(base);
      
      const sculptureGeometry = this.geometryPool.sphere.clone();
      sculptureGeometry.scale(size * 0.7, size * 1.2, size * 0.7);
      const sculpture = new THREE.Mesh(sculptureGeometry, iceMaterial);
      sculpture.position.y = size * 1.5;
      group.add(sculpture);
      
      // Add some variety to the sculpture
      for (let p = 0; p < 3; p++) {
        const partGeometry = this.geometryPool.box.clone();
        partGeometry.scale(size * 0.2, size * 0.4, size * 0.2);
        const part = new THREE.Mesh(partGeometry, iceMaterial);
        const angle = r() * Math.PI * 2;
        part.position.set(
          Math.cos(angle) * size * 0.5,
          size * (1 + r() * 0.5),
          Math.sin(angle) * size * 0.5
        );
        part.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI / 4);
        group.add(part);
      }
      
      itemName = "Ice Sculpture";
    }
    
    return [group, itemName];
  }
  
  // Generate buildings (city-oriented but can appear in any biome with different styles)
  generateBuildings(chunk, biome, terrainChunk, count, r, getValidPosition, groundObjects) {
    const chunkSize = terrainChunk.chunkSize;
    
    for (let i = 0; i < count; i++) {  
      const width = 3 + r() * 5;   
      const height = 6 + r() * 14;
      const size = Math.max(width, height);
      
      const pos = getValidPosition(width, chunkSize);
      if (!pos) continue;
      
      // Get terrain height
      const terrainHeight = terrainChunk.getHeightAt(pos.x, pos.z);
      
      let group, itemName;
      
      if (biome === this.biomeManager.biomes.CITY) {
        [group, itemName] = this.generateCityBuilding(width, height, r);
      } else if (biome === this.biomeManager.biomes.FOREST) {
        [group, itemName] = this.generateForestBuilding(width, height, r);
      } else if (biome === this.biomeManager.biomes.DESERT) {
        [group, itemName] = this.generateDesertBuilding(width, height, r);
      } else if (biome === this.biomeManager.biomes.MOUNTAINS) {
        [group, itemName] = this.generateMountainBuilding(width, height, r);
      } else if (biome === this.biomeManager.biomes.SNOW) {
        [group, itemName] = this.generateSnowBuilding(width, height, r);
      }
      
      group.userData.itemName = itemName;
      group.position.set(pos.x, terrainHeight + height/2, pos.z);
      this.scene.add(group);

      const shape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, width/2));
      const body = new CANNON.Body({
        mass: width * height * 2,
        shape: shape,
        position: new CANNON.Vec3(pos.x, terrainHeight + height/2, pos.z)
      });
      this.world.addBody(body);

      groundObjects.push({ mesh: group, body });
    }
  }
  
  // Generate city building (skyscraper)
  generateCityBuilding(width, height, r) {
    const group = new THREE.Group();
    
    // Modern building
    const buildingGeometry = this.geometryPool.box.clone();
    buildingGeometry.scale(width, height, width);
    const buildingMaterial = this.getMaterial(this.biomeManager.biomes.CITY.buildingColor);
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    group.add(building);
    
    const windows = this.createWindows(width, height);
    group.add(windows);
    
    const roofDetail = new THREE.Mesh(
      this.geometryPool.box.clone(),
      buildingMaterial
    );
    roofDetail.scale.set(width * 0.7, height * 0.1, width * 0.7);
    roofDetail.position.y = height/2 + height * 0.05;
    group.add(roofDetail);
    
    return [group, "Skyscraper"];
  }
  
  // Generate forest building (cabin)
  generateForestBuilding(width, height, r) {
    const group = new THREE.Group();
    
    // Wooden cabin
    const cabinGeometry = this.geometryPool.box.clone();
    cabinGeometry.scale(width, height * 0.6, width);
    const cabinMaterial = this.getMaterial(0x8B4513);
    const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
    cabin.position.y = height * 0.3;
    group.add(cabin);
    
    // Roof
    const roofGeometry = this.geometryPool.box.clone();
    roofGeometry.scale(width * 1.2, height * 0.2, width * 1.2);
    const roofMaterial = this.getMaterial(0x654321);
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = height * 0.7;
    group.add(roof);
    
    // Chimney
    const chimneyGeometry = this.geometryPool.box.clone();
    chimneyGeometry.scale(width * 0.2, height * 0.3, width * 0.2);
    const chimney = new THREE.Mesh(chimneyGeometry, cabinMaterial);
    chimney.position.set(width * 0.3, height * 0.8, width * 0.3);
    group.add(chimney);
    
    return [group, "Cabin"];
  }
  
  // Generate desert building (adobe)
  generateDesertBuilding(width, height, r) {
    const group = new THREE.Group();
    
    // Adobe building
    const buildingGeometry = this.geometryPool.box.clone();
    buildingGeometry.scale(width, height * 0.5, width);
    const buildingMaterial = this.getMaterial(0xDEB887);
    const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
    building.position.y = height * 0.25;
    group.add(building);
    
    // Flat roof
    const roofGeometry = this.geometryPool.box.clone();
    roofGeometry.scale(width, height * 0.05, width);
    const roof = new THREE.Mesh(roofGeometry, buildingMaterial);
    roof.position.y = height * 0.52;
    group.add(roof);
    
    return [group, "Adobe Building"];
  }
  
  // Generate mountain building (stone tower)
  generateMountainBuilding(width, height, r) {
    const group = new THREE.Group();
    
    // Stone tower
    const towerGeometry = this.geometryPool.cylinder.clone();
    towerGeometry.scale(width * 0.7, height, width * 0.7);
    const towerMaterial = this.getMaterial(0x808080);
    const tower = new THREE.Mesh(towerGeometry, towerMaterial);
    tower.position.y = height * 0.5;
    group.add(tower);
    
    // Cone roof
    const roofGeometry = this.geometryPool.cylinder.clone();
    roofGeometry.scale(width * 0.8, height * 0.3, width * 0.8);
    const roofMaterial = this.getMaterial(0x505050);
    const roof = new THREE.Mesh(roofGeometry, roofMaterial);
    roof.position.y = height * 1.2;
    group.add(roof);
    
    return [group, "Stone Tower"];
  }
  
  // Generate snow building (ice palace)
  generateSnowBuilding(width, height, r) {
    const group = new THREE.Group();
    
    // Ice palace
    const palaceGeometry = this.geometryPool.box.clone();
    palaceGeometry.scale(width, height * 0.7, width);
    const palaceMaterial = new THREE.MeshPhongMaterial({
      color: 0xCCEEFF,
      transparent: true,
      opacity: 0.7,
      shininess: 100
    });
    const palace = new THREE.Mesh(palaceGeometry, palaceMaterial);
    palace.position.y = height * 0.35;
    group.add(palace);
    
    // Towers at corners
    for (let c = 0; c < 4; c++) {
      const towerGeometry = this.geometryPool.cylinder.clone();
      towerGeometry.scale(width * 0.2, height * 0.9, width * 0.2);
      const tower = new THREE.Mesh(towerGeometry, palaceMaterial);
      tower.position.set(
        (c % 2 ? 1 : -1) * width * 0.5,
        height * 0.45,
        (c < 2 ? 1 : -1) * width * 0.5
      );
      group.add(tower);
      
      // Pointy top
      const topGeometry = this.geometryPool.cylinder.clone();
      topGeometry.scale(width * 0.25, height * 0.2, width * 0.25);
      const top = new THREE.Mesh(topGeometry, palaceMaterial);
      top.position.set(
        (c % 2 ? 1 : -1) * width * 0.5,
        height * 0.9,
        (c < 2 ? 1 : -1) * width * 0.5
      );
      group.add(top);
    }
    
    return [group, "Ice Palace"];
  }
}
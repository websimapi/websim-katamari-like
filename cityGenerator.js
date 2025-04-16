import { FlyingCreature } from './flyingCreatures.js';
import { TerrainChunk } from './TerrainChunk.js';

export class CityGenerator {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.chunkSize = 100;
    this.loadedChunks = new Set();
    
    // Map structure: key -> { terrain: TerrainChunk, ground: Array of ground objects, flying: Array of flying creatures }
    this.objects = new Map();
    this.minObjectSize = 0.2;   // Minimum size for collectibles
    this.maxObjectSize = 15;    // Maximum size for buildings
    
    // Biome types
    this.biomes = {
      CITY: {
        color: 0x909090,
        secondaryColor: 0x707070,
        buildingColor: 0x808080,
        objectColors: [0xFF0000, 0x00FF00, 0x0000FF, 0xFFFF00, 0xFF00FF],
        elevation: { min: -2, max: 2 },
        roughness: 0.2,
        objects: {
          tiny: 50,
          medium: 30,
          large: 10,
          buildings: 15
        }
      },
      FOREST: {
        color: 0x2D5F34,
        secondaryColor: 0x1E3F24,
        buildingColor: 0x8B4513,
        objectColors: [0x8B4513, 0x006400, 0x228B22, 0x556B2F, 0x808000],
        elevation: { min: -5, max: 15 },
        roughness: 0.6,
        objects: {
          tiny: 40,
          medium: 60,
          large: 15,
          buildings: 3
        }
      },
      DESERT: {
        color: 0xE8C98A,
        secondaryColor: 0xD2B48C,
        buildingColor: 0xCD853F,
        objectColors: [0xF4A460, 0xD2B48C, 0xDEB887, 0xBDB76B, 0xDAA520],
        elevation: { min: -3, max: 8 },
        roughness: 0.3,
        objects: {
          tiny: 30,
          medium: 15,
          large: 8,
          buildings: 5
        }
      },
      MOUNTAINS: {
        color: 0x707070,
        secondaryColor: 0x505050,
        buildingColor: 0x696969,
        objectColors: [0x708090, 0x778899, 0xA9A9A9, 0xC0C0C0, 0xD3D3D3],
        elevation: { min: 5, max: 25 },
        roughness: 0.8,
        objects: {
          tiny: 20,
          medium: 10,
          large: 5,
          buildings: 2
        }
      },
      SNOW: {
        color: 0xE8E8E8,
        secondaryColor: 0xD8D8D8,
        buildingColor: 0xF0F0F0,
        objectColors: [0xF5F5F5, 0xFFFAFA, 0xF0FFFF, 0xF5FFFA, 0xF0FFF0],
        elevation: { min: 0, max: 15 },
        roughness: 0.5,
        objects: {
          tiny: 25,
          medium: 20,
          large: 10,
          buildings: 5
        }
      }
    };
    
    // Implement improved Perlin noise
    this.initPerlinNoise();
  }
  
  // Implement a proper Perlin noise algorithm
  initPerlinNoise() {
    // Generate and cache permutation table
    this.perm = new Uint8Array(512);
    const p = new Uint8Array(256);
    
    // Initialize with values 0-255
    for (let i = 0; i < 256; i++) {
      p[i] = i;
    }
    
    // Shuffle array
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [p[i], p[j]] = [p[j], p[i]];
    }
    
    // Copy to 512 length array for wrapping
    for (let i = 0; i < 512; i++) {
      this.perm[i] = p[i & 255];
    }
    
    // Define gradient vectors for 3D space
    this.gradP = new Array(512);
    this.grad3 = [
      [1, 1, 0], [-1, 1, 0], [1, -1, 0], [-1, -1, 0],
      [1, 0, 1], [-1, 0, 1], [1, 0, -1], [-1, 0, -1],
      [0, 1, 1], [0, -1, 1], [0, 1, -1], [0, -1, -1]
    ];
    
    // Populate gradient array
    for (let i = 0; i < 512; i++) {
      const index = this.perm[i] % 12;
      this.gradP[i] = this.grad3[index];
    }
  }
  
  // Linear interpolation helper
  lerp(a, b, t) {
    return (1 - t) * a + t * b;
  }
  
  // Fade function for smooth interpolation (improves visual quality)
  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  
  // Properly implemented Perlin noise function
  perlin3D(x, y, z) {
    // Find unit grid cell containing point
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const Z = Math.floor(z) & 255;
    
    // Get relative xyz coordinates of point within cell
    x -= Math.floor(x);
    y -= Math.floor(y);
    z -= Math.floor(z);
    
    // Compute fade curves for each coordinate
    const u = this.fade(x);
    const v = this.fade(y);
    const w = this.fade(z);
    
    // Hash coordinates of the 8 cube corners
    const A = this.perm[X] + Y;
    const AA = this.perm[A] + Z;
    const AB = this.perm[A + 1] + Z;
    const B = this.perm[X + 1] + Y;
    const BA = this.perm[B] + Z;
    const BB = this.perm[B + 1] + Z;
    
    // Calculate noise contributions from each corner
    const g000 = this.gradP[this.perm[AA]];
    const g001 = this.gradP[this.perm[AB]];
    const g010 = this.gradP[this.perm[AA + 1]];
    const g011 = this.gradP[this.perm[AB + 1]];
    const g100 = this.gradP[this.perm[BA]];
    const g101 = this.gradP[this.perm[BB]];
    const g110 = this.gradP[this.perm[BA + 1]];
    const g111 = this.gradP[this.perm[BB + 1]];
    
    // Dot products
    const n000 = g000[0] * x + g000[1] * y + g000[2] * z;
    const n100 = g100[0] * (x - 1) + g100[1] * y + g100[2] * z;
    const n010 = g010[0] * x + g010[1] * (y - 1) + g010[2] * z;
    const n110 = g110[0] * (x - 1) + g110[1] * (y - 1) + g110[2] * z;
    const n001 = g001[0] * x + g001[1] * y + g001[2] * (z - 1);
    const n101 = g101[0] * (x - 1) + g101[1] * y + g101[2] * (z - 1);
    const n011 = g011[0] * x + g011[1] * (y - 1) + g011[2] * (z - 1);
    const n111 = g111[0] * (x - 1) + g111[1] * (y - 1) + g111[2] * (z - 1);
    
    // Interpolate along x
    const nx00 = this.lerp(n000, n100, u);
    const nx01 = this.lerp(n001, n101, u);
    const nx10 = this.lerp(n010, n110, u);
    const nx11 = this.lerp(n011, n111, u);
    
    // Interpolate along y
    const nxy0 = this.lerp(nx00, nx10, v);
    const nxy1 = this.lerp(nx01, nx11, v);
    
    // Interpolate along z and return
    return this.lerp(nxy0, nxy1, w);
  }
  
  // Function to generate multi-octave Perlin noise (fractal Brownian motion)
  noise(x, y, z = 0) {
    // Scale inputs for more natural terrain
    const scale = 0.01;
    x = x * scale;
    y = y * scale;
    z = z * scale;
    
    let total = 0;
    let frequency = 1;
    let amplitude = 1;
    let maxValue = 0;
    
    // Sum multiple octaves of noise
    for (let i = 0; i < 6; i++) {
      total += this.perlin3D(x * frequency, y * frequency, z * frequency) * amplitude;
      maxValue += amplitude;
      amplitude *= 0.5;
      frequency *= 2;
    }
    
    // Normalize to -1 to 1 range
    return total / maxValue;
  }

  getBiomeForPosition(x, z) {
    // Use noise to determine the biome type
    // Use a different seed (by using z as third param) to separate biome from terrain noise
    const noiseValue = this.noise(x, z, 123.456);
    
    if (noiseValue < -0.6) {
      return this.biomes.SNOW;
    } else if (noiseValue < -0.2) {
      return this.biomes.MOUNTAINS;
    } else if (noiseValue < 0.2) {
      return this.biomes.FOREST;
    } else if (noiseValue < 0.6) {
      return this.biomes.DESERT;
    } else {
      return this.biomes.CITY;
    }
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
    // Determine the primary biome for this chunk based on its center
    const chunkCenterX = (chunk.x * this.chunkSize) + this.chunkSize / 2;
    const chunkCenterZ = (chunk.z * this.chunkSize) + this.chunkSize / 2;
    const biome = this.getBiomeForPosition(chunkCenterX, chunkCenterZ);
    
    // Create a terrain chunk with the proper noise function
    const terrainChunk = new TerrainChunk(
      this.scene, 
      this.world, 
      chunk.x, 
      chunk.z, 
      this.chunkSize,
      biome,
      (x, z) => this.noise(x, z) // Use our improved Perlin noise
    );
    
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
      const colors = biome.objectColors;
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

    // Use biome-specific object counts
    const objectCounts = biome.objects;

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
          if (r() < 0.5) {
            const windowPane = new THREE.Mesh(windowGeometry, windowMaterial);
            windowPane.position.set(x, y, width/2 + 0.1);
            windowGroup.add(windowPane);
          }
        }
      }
      return windowGroup;
    };

    // Helper to get terrain height at a position
    const getHeightAtPosition = (x, z) => {
      return terrainChunk.getHeightAt(x, z);
    };

    // Generate tiny collectibles
    for (let i = 0; i < objectCounts.tiny; i++) {  
      const size = this.minObjectSize + r() * 0.3;
      const pos = getValidPosition(size);
      if (!pos) continue;
      
      // Get terrain height at this position
      const terrainHeight = getHeightAtPosition(pos.x, pos.z);
      
      let mesh;
      if (r() < 0.5) {
        const geometry = geometryPool.box.clone();
        geometry.scale(size * 2, size * 2, size * 2);
        const material = getMaterial(seededGetRandomColor());
        mesh = new THREE.Mesh(geometry, material);
        mesh.rotation.x = r() * Math.PI;
        mesh.rotation.y = r() * Math.PI;
        
        if (biome === this.biomes.CITY) {
          mesh.userData.itemName = "Paper";
        } else if (biome === this.biomes.FOREST) {
          mesh.userData.itemName = "Leaf";
        } else if (biome === this.biomes.DESERT) {
          mesh.userData.itemName = "Stone";
        } else if (biome === this.biomes.MOUNTAINS) {
          mesh.userData.itemName = "Rock";
        } else if (biome === this.biomes.SNOW) {
          mesh.userData.itemName = "Snowball";
        }
      } else {
        const geometry = geometryPool.sphere.clone();
        geometry.scale(size, size, size);
        const material = getMaterial(seededGetRandomColor());
        mesh = new THREE.Mesh(geometry, material);
        
        if (biome === this.biomes.CITY) {
          mesh.userData.itemName = "Crumpled Paper Ball";
        } else if (biome === this.biomes.FOREST) {
          mesh.userData.itemName = "Berry";
        } else if (biome === this.biomes.DESERT) {
          mesh.userData.itemName = "Pebble";
        } else if (biome === this.biomes.MOUNTAINS) {
          mesh.userData.itemName = "Ore";
        } else if (biome === this.biomes.SNOW) {
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

    // Generate medium collectibles with biome-specific objects
    for (let i = 0; i < objectCounts.medium; i++) {  
      const size = 0.5 + r() * 2;
      const pos = getValidPosition(size);
      if (!pos) continue;
      
      // Get terrain height at this position
      const terrainHeight = getHeightAtPosition(pos.x, pos.z);
      
      let mesh;
      let itemName = "Item";
      
      if (biome === this.biomes.CITY) {
        if (r() < 0.5) {
          // Trash bin
          const group = new THREE.Group();
          const bodyGeometry = geometryPool.cylinder.clone();
          bodyGeometry.scale(size/2, size, size/2);
          const bodyMaterial = getMaterial(seededGetRandomColor());
          const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
          group.add(bodyMesh);
          const rimGeometry = geometryPool.cylinder.clone();
          rimGeometry.scale(size/2 * 1.1, size/10, size/2 * 1.1);
          const rim = new THREE.Mesh(rimGeometry, bodyMaterial);
          rim.position.y = size/2;
          group.add(rim);
          mesh = group;
          itemName = "Trash Bin";
        } else {
          // Box
          const group = new THREE.Group();
          const boxGeometry = geometryPool.box.clone();
          boxGeometry.scale(size, size, size);
          const boxMaterial = getMaterial(seededGetRandomColor());
          const boxMesh = new THREE.Mesh(boxGeometry, boxMaterial);
          group.add(boxMesh);
          const edgeGeometry = geometryPool.box.clone();
          edgeGeometry.scale(size * 1.1, size/10, size * 1.1);
          const edgeMaterial = getMaterial(0x333333);
          const topEdge = new THREE.Mesh(edgeGeometry, edgeMaterial);
          topEdge.position.y = size/2;
          group.add(topEdge);
          mesh = group;
          itemName = "Box";
        }
      } else if (biome === this.biomes.FOREST) {
        if (r() < 0.5) {
          // Bush
          const group = new THREE.Group();
          for (let j = 0; j < 5; j++) {
            const leafGeometry = geometryPool.sphere.clone();
            const scale = 0.5 + r() * 0.5;
            leafGeometry.scale(size * scale, size * scale, size * scale);
            const leafMaterial = getMaterial(0x228B22);
            const leaf = new THREE.Mesh(leafGeometry, leafMaterial);
            leaf.position.set(
              (r() - 0.5) * size,
              (r() - 0.5) * size + size/2,
              (r() - 0.5) * size
            );
            group.add(leaf);
          }
          mesh = group;
          itemName = "Bush";
        } else {
          // Stump
          const group = new THREE.Group();
          const trunkGeometry = geometryPool.cylinder.clone();
          trunkGeometry.scale(size/2, size/2, size/2);
          const trunkMaterial = getMaterial(0x8B4513);
          const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
          trunk.position.y = -size/4;
          group.add(trunk);
          const topGeometry = geometryPool.cylinder.clone();
          topGeometry.scale(size/1.8, size/10, size/1.8);
          const top = new THREE.Mesh(topGeometry, trunkMaterial);
          group.add(top);
          mesh = group;
          itemName = "Tree Stump";
        }
      } else if (biome === this.biomes.DESERT) {
        if (r() < 0.5) {
          // Cactus
          const group = new THREE.Group();
          const bodyGeometry = geometryPool.cylinder.clone();
          bodyGeometry.scale(size/4, size, size/4);
          const bodyMaterial = getMaterial(0x2F4F4F);
          const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
          group.add(body);
          
          if (r() < 0.7) {
            const armGeometry = geometryPool.cylinder.clone();
            armGeometry.scale(size/6, size/2, size/6);
            const arm = new THREE.Mesh(armGeometry, bodyMaterial);
            arm.rotation.z = Math.PI / 4;
            arm.position.set(size/2, size/4, 0);
            group.add(arm);
          }
          
          mesh = group;
          itemName = "Cactus";
        } else {
          // Rock formation
          const group = new THREE.Group();
          for (let j = 0; j < 3; j++) {
            const rockGeometry = geometryPool.sphere.clone();
            const scale = 0.5 + r() * 0.5;
            rockGeometry.scale(size * scale, size * scale * 0.7, size * scale);
            const rockMaterial = getMaterial(0xAA8866);
            const rock = new THREE.Mesh(rockGeometry, rockMaterial);
            rock.position.set(
              (r() - 0.5) * size,
              (r() * 0.5) * size,
              (r() - 0.5) * size
            );
            rock.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI);
            group.add(rock);
          }
          mesh = group;
          itemName = "Rock Formation";
        }
      } else if (biome === this.biomes.MOUNTAINS) {
        if (r() < 0.5) {
          // Boulder
          const group = new THREE.Group();
          const baseGeometry = geometryPool.sphere.clone();
          baseGeometry.scale(size, size * 0.8, size);
          const material = getMaterial(0x808080);
          const base = new THREE.Mesh(baseGeometry, material);
          group.add(base);
          
          // Add some detail to the boulder
          for (let j = 0; j < 3; j++) {
            const detailGeometry = geometryPool.sphere.clone();
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
          
          mesh = group;
          itemName = "Boulder";
        } else {
          // Crystal formation
          const group = new THREE.Group();
          for (let j = 0; j < 5; j++) {
            const crystalGeometry = geometryPool.box.clone();
            const scale = 0.3 + r() * 0.3;
            crystalGeometry.scale(size * scale * 0.3, size * scale, size * scale * 0.3);
            const crystalMaterial = getMaterial(0x8888FF);
            const crystal = new THREE.Mesh(crystalGeometry, crystalMaterial);
            crystal.position.set(
              (r() - 0.5) * size * 0.7,
              (r() * 0.5) * size,
              (r() - 0.5) * size * 0.7
            );
            crystal.rotation.set(0, r() * Math.PI * 2, r() * Math.PI / 6);
            group.add(crystal);
          }
          mesh = group;
          itemName = "Crystal Formation";
        }
      } else if (biome === this.biomes.SNOW) {
        if (r() < 0.5) {
          // Snowdrift
          const group = new THREE.Group();
          for (let j = 0; j < 3; j++) {
            const snowGeometry = geometryPool.sphere.clone();
            const scale = 0.5 + r() * 0.5;
            snowGeometry.scale(size * scale, size * scale * 0.6, size * scale);
            const snowMaterial = getMaterial(0xFFFFFF);
            const snow = new THREE.Mesh(snowGeometry, snowMaterial);
            snow.position.set(
              (r() - 0.5) * size,
              (r() * 0.3) * size,
              (r() - 0.5) * size
            );
            group.add(snow);
          }
          mesh = group;
          itemName = "Snowdrift";
        } else {
          // Ice block
          const group = new THREE.Group();
          const iceGeometry = geometryPool.box.clone();
          iceGeometry.scale(size, size, size);
          const iceMaterial = new THREE.MeshPhongMaterial({
            color: 0xAADDFF,
            transparent: true,
            opacity: 0.8,
            shininess: 90
          });
          const ice = new THREE.Mesh(iceGeometry, iceMaterial);
          group.add(ice);
          
          mesh = group;
          itemName = "Ice Block";
        }
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

    // Generate large objects based on biome
    for (let i = 0; i < objectCounts.large; i++) {
      const size = 2 + r() * 3;
      const pos = getValidPosition(size * 2);
      if (!pos) continue;
      
      // Get terrain height at this position
      const terrainHeight = getHeightAtPosition(pos.x, pos.z);
      
      const group = new THREE.Group();
      let itemName = "Structure";
      
      if (biome === this.biomes.CITY) {
        if (r() < 0.5) {
          // Car
          const bodyGeometry = geometryPool.box.clone();
          bodyGeometry.scale(size * 2, size * 0.8, size * 1.5);
          const bodyMaterial = getMaterial(seededGetRandomColor());
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
          itemName = "Car";
        } else {
          // Structure
          const levels = 2 + Math.floor(r() * 3);
          for (let l = 0; l < levels; l++) {
            const levelGeometry = geometryPool.box.clone();
            levelGeometry.scale(size * (1 - l * 0.2), size, size * (1 - l * 0.2));
            const levelMaterial = getMaterial(0x808080);
            const level = new THREE.Mesh(levelGeometry, levelMaterial);
            level.position.y = l * size;
            group.add(level);
          }
          itemName = "Structure";
        }
      } else if (biome === this.biomes.FOREST) {
        // Tree
        const trunkGeometry = geometryPool.cylinder.clone();
        trunkGeometry.scale(size * 0.3, size * 1.8, size * 0.3);
        const trunkMaterial = getMaterial(0x8B4513);
        const trunk = new THREE.Mesh(trunkGeometry, trunkMaterial);
        trunk.position.y = size * 0.9;
        group.add(trunk);
        
        // Foliage
        const foliageGeometry = geometryPool.sphere.clone();
        foliageGeometry.scale(size * 1.2, size, size * 1.2);
        const foliageMaterial = getMaterial(0x228B22);
        const foliage = new THREE.Mesh(foliageGeometry, foliageMaterial);
        foliage.position.y = size * 2.2;
        group.add(foliage);
        
        itemName = "Tree";
      } else if (biome === this.biomes.DESERT) {
        if (r() < 0.3) {
          // Large cactus
          const mainStemGeometry = geometryPool.cylinder.clone();
          mainStemGeometry.scale(size * 0.4, size * 2, size * 0.4);
          const stemMaterial = getMaterial(0x2F4F4F);
          const mainStem = new THREE.Mesh(mainStemGeometry, stemMaterial);
          mainStem.position.y = size;
          group.add(mainStem);
          
          // Arms
          const numArms = 1 + Math.floor(r() * 3);
          for (let a = 0; a < numArms; a++) {
            const armGeometry = geometryPool.cylinder.clone();
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
            const levelGeometry = geometryPool.box.clone();
            const levelScale = 1 - (l / levels) * 0.6;
            levelGeometry.scale(size * 1.5 * levelScale, size * 0.5, size * 1.5 * levelScale);
            // Slightly vary the color of each level
            const levelColor = new THREE.Color(baseColor).offsetHSL(0, 0, (r() - 0.5) * 0.1);
            const levelMaterial = getMaterial(levelColor.getHex());
            const level = new THREE.Mesh(levelGeometry, levelMaterial);
            level.position.y = l * size * 0.5;
            group.add(level);
          }
          
          itemName = "Mesa";
        }
      } else if (biome === this.biomes.MOUNTAINS) {
        // Mountain peak
        const peakGeometry = geometryPool.cylinder.clone();
        peakGeometry.scale(size * 1.5, size * 2, size * 1.5);
        const peakMaterial = getMaterial(0x808080);
        const base = new THREE.Mesh(peakGeometry, peakMaterial);
        base.position.y = size;
        group.add(base);
        
        const topGeometry = geometryPool.cylinder.clone();
        topGeometry.scale(size * 0.8, size, size * 0.8);
        const top = new THREE.Mesh(topGeometry, peakMaterial);
        top.position.y = size * 2.5;
        group.add(top);
        
        // Snow cap
        const snowGeometry = geometryPool.cylinder.clone();
        snowGeometry.scale(size * 0.85, size * 0.2, size * 0.85);
        const snowMaterial = getMaterial(0xFFFFFF);
        const snow = new THREE.Mesh(snowGeometry, snowMaterial);
        snow.position.y = size * 3;
        group.add(snow);
        
        itemName = "Mountain Peak";
      } else if (biome === this.biomes.SNOW) {
        if (r() < 0.5) {
          // Snowman
          const bodyGeometry = geometryPool.sphere.clone();
          bodyGeometry.scale(size, size, size);
          const bodyMaterial = getMaterial(0xFFFFFF);
          const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
          body.position.y = size;
          group.add(body);
          
          const middleGeometry = geometryPool.sphere.clone();
          middleGeometry.scale(size * 0.7, size * 0.7, size * 0.7);
          const middle = new THREE.Mesh(middleGeometry, bodyMaterial);
          middle.position.y = size * 2.3;
          group.add(middle);
          
          const headGeometry = geometryPool.sphere.clone();
          headGeometry.scale(size * 0.5, size * 0.5, size * 0.5);
          const head = new THREE.Mesh(headGeometry, bodyMaterial);
          head.position.y = size * 3.2;
          group.add(head);
          
          // Eyes and nose
          const eyeGeometry = geometryPool.sphere.clone();
          eyeGeometry.scale(size * 0.08, size * 0.08, size * 0.08);
          const eyeMaterial = getMaterial(0x000000);
          const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
          leftEye.position.set(-size * 0.2, size * 3.3, size * 0.4);
          group.add(leftEye);
          
          const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
          rightEye.position.set(size * 0.2, size * 3.3, size * 0.4);
          group.add(rightEye);
          
          const noseGeometry = geometryPool.cylinder.clone();
          noseGeometry.scale(size * 0.05, size * 0.3, size * 0.05);
          const noseMaterial = getMaterial(0xFF6600);
          const nose = new THREE.Mesh(noseGeometry, noseMaterial);
          nose.position.set(0, size * 3.2, size * 0.6);
          nose.rotation.x = Math.PI / 2;
          group.add(nose);
          
          itemName = "Snowman";
        } else {
          // Ice sculpture
          const baseGeometry = geometryPool.box.clone();
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
          
          const sculptureGeometry = geometryPool.sphere.clone();
          sculptureGeometry.scale(size * 0.7, size * 1.2, size * 0.7);
          const sculpture = new THREE.Mesh(sculptureGeometry, iceMaterial);
          sculpture.position.y = size * 1.5;
          group.add(sculpture);
          
          // Add some variety to the sculpture
          for (let p = 0; p < 3; p++) {
            const partGeometry = geometryPool.box.clone();
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
    
    // Generate buildings (city-oriented but can appear in any biome with different styles)
    for (let i = 0; i < objectCounts.buildings; i++) {  
      const width = 3 + r() * 5;   
      const height = 6 + r() * 14;
      const size = Math.max(width, height);
      
      const pos = getValidPosition(width);
      if (!pos) continue;
      
      // Get terrain height
      const terrainHeight = getHeightAtPosition(pos.x, pos.z);
      
      const group = new THREE.Group();
      let itemName = "Building";
      
      if (biome === this.biomes.CITY) {
        // Modern building
        const buildingGeometry = geometryPool.box.clone();
        buildingGeometry.scale(width, height, width);
        const buildingMaterial = getMaterial(biome.buildingColor);
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
        
        itemName = "Skyscraper";
      } else if (biome === this.biomes.FOREST) {
        // Wooden cabin
        const cabinGeometry = geometryPool.box.clone();
        cabinGeometry.scale(width, height * 0.6, width);
        const cabinMaterial = getMaterial(0x8B4513);
        const cabin = new THREE.Mesh(cabinGeometry, cabinMaterial);
        cabin.position.y = height * 0.3;
        group.add(cabin);
        
        // Roof
        const roofGeometry = geometryPool.box.clone();
        roofGeometry.scale(width * 1.2, height * 0.2, width * 1.2);
        const roofMaterial = getMaterial(0x654321);
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = height * 0.7;
        group.add(roof);
        
        // Chimney
        const chimneyGeometry = geometryPool.box.clone();
        chimneyGeometry.scale(width * 0.2, height * 0.3, width * 0.2);
        const chimney = new THREE.Mesh(chimneyGeometry, cabinMaterial);
        chimney.position.set(width * 0.3, height * 0.8, width * 0.3);
        group.add(chimney);
        
        itemName = "Cabin";
      } else if (biome === this.biomes.DESERT) {
        // Adobe building
        const buildingGeometry = geometryPool.box.clone();
        buildingGeometry.scale(width, height * 0.5, width);
        const buildingMaterial = getMaterial(0xDEB887);
        const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
        building.position.y = height * 0.25;
        group.add(building);
        
        // Flat roof
        const roofGeometry = geometryPool.box.clone();
        roofGeometry.scale(width, height * 0.05, width);
        const roof = new THREE.Mesh(roofGeometry, buildingMaterial);
        roof.position.y = height * 0.52;
        group.add(roof);
        
        itemName = "Adobe Building";
      } else if (biome === this.biomes.MOUNTAINS) {
        // Stone tower
        const towerGeometry = geometryPool.cylinder.clone();
        towerGeometry.scale(width * 0.7, height, width * 0.7);
        const towerMaterial = getMaterial(0x808080);
        const tower = new THREE.Mesh(towerGeometry, towerMaterial);
        tower.position.y = height * 0.5;
        group.add(tower);
        
        // Cone roof
        const roofGeometry = geometryPool.cylinder.clone();
        roofGeometry.scale(width * 0.8, height * 0.3, width * 0.8);
        const roofMaterial = getMaterial(0x505050);
        const roof = new THREE.Mesh(roofGeometry, roofMaterial);
        roof.position.y = height * 1.2;
        group.add(roof);
        
        itemName = "Stone Tower";
      } else if (biome === this.biomes.SNOW) {
        // Ice palace
        const palaceGeometry = geometryPool.box.clone();
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
          const towerGeometry = geometryPool.cylinder.clone();
          towerGeometry.scale(width * 0.2, height * 0.9, width * 0.2);
          const tower = new THREE.Mesh(towerGeometry, palaceMaterial);
          tower.position.set(
            (c % 2 ? 1 : -1) * width * 0.5,
            height * 0.45,
            (c < 2 ? 1 : -1) * width * 0.5
          );
          group.add(tower);
          
          // Pointy top
          const topGeometry = geometryPool.cylinder.clone();
          topGeometry.scale(width * 0.25, height * 0.2, width * 0.25);
          const top = new THREE.Mesh(topGeometry, palaceMaterial);
          top.position.set(
            (c % 2 ? 1 : -1) * width * 0.5,
            height * 0.9,
            (c < 2 ? 1 : -1) * width * 0.5
          );
          group.add(top);
        }
        
        itemName = "Ice Palace";
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
    
    // Generate flying creatures within this chunk, type based on biome
    let flyingTypes = ['butterfly', 'eagle', 'bee'];
    
    if (biome === this.biomes.FOREST) {
      flyingTypes = ['butterfly', 'bee', 'bird'];
    } else if (biome === this.biomes.DESERT) {
      flyingTypes = ['eagle', 'vulture', 'dragonfly'];
    } else if (biome === this.biomes.MOUNTAINS) {
      flyingTypes = ['eagle', 'hawk', 'bat'];
    } else if (biome === this.biomes.SNOW) {
      flyingTypes = ['snowbird', 'owl', 'hawk'];
    }
    
    const flyingCount = 3 + Math.floor(r() * 3);
    for (let i = 0; i < flyingCount; i++) {
      const type = flyingTypes[Math.floor(r() * flyingTypes.length)];
      const x = (chunk.x * this.chunkSize) + r() * this.chunkSize;
      const z = (chunk.z * this.chunkSize) + r() * this.chunkSize;
      const y = terrainChunk.getHeightAt(x, z) + 15 + r() * 35;
      const position = new THREE.Vector3(x, y, z);
      const creature = new FlyingCreature(this.scene, type, position);
      flyingCreatures.push(creature);
    }

    const key = `${chunk.x},${chunk.z}`;
    this.objects.set(key, { 
      terrain: terrainChunk,
      ground: groundObjects, 
      flying: flyingCreatures 
    });
  }

  removeChunk(chunk) {
    const key = `${chunk.x},${chunk.z}`;
    const chunkData = this.objects.get(key);
    if (chunkData) {
      // Remove terrain
      if (chunkData.terrain) {
        chunkData.terrain.dispose();
      }
      
      // Remove ground objects
      chunkData.ground.forEach(obj => {
        if (obj.mesh) {
          if (obj.mesh.geometry) obj.mesh.geometry.dispose();
          if (obj.mesh.material) {
            if (Array.isArray(obj.mesh.material)) {
              obj.mesh.material.forEach(m => m && m.dispose());
            } else if (obj.mesh.material) {
              obj.mesh.material.dispose();
            }
          }
          this.scene.remove(obj.mesh);
        }
        if (obj.body) {
          this.world.removeBody(obj.body);
        }
      });
      
      // Dispose flying creatures
      chunkData.flying.forEach(creature => {
        if (creature) creature.dispose();
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
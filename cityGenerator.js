import { NoiseGenerator } from './NoiseGenerator.js';
import { BiomeManager } from './BiomeManager.js';
import { ObjectGenerator } from './ObjectGenerator.js';
import { FlyingCreaturesGenerator } from './FlyingCreaturesGenerator.js';
import { TerrainChunk } from './TerrainChunk.js';

export class CityGenerator {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.chunkSize = 100;
    this.loadedChunks = new Set();
    
    // Map structure: key -> { terrain: TerrainChunk, ground: Array of ground objects, flying: Array of flying creatures }
    this.objects = new Map();
    
    // Initialize subsystems
    this.noiseGenerator = new NoiseGenerator();
    this.biomeManager = new BiomeManager(this.noiseGenerator);
    this.objectGenerator = new ObjectGenerator(scene, world, this.biomeManager);
    this.flyingCreaturesGenerator = new FlyingCreaturesGenerator(scene, this.biomeManager);
    
    // Reference to biomes for external access
    this.biomes = this.biomeManager.biomes;
  }
  
  getBiomeForPosition(x, z) {
    return this.biomeManager.getBiomeForPosition(x, z);
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
      (x, z) => this.noiseGenerator.noise(x, z) // Use our improved Perlin noise
    );
    
    // Seeded random generator based on chunk coordinates.
    // Using a simple LCG: seedValue will be updated every call to r()
    let seedValue = (((chunk.x + 1000) * 10000) + (chunk.z + 1000)) % 233280;
    function r() {
      seedValue = (seedValue * 9301 + 49297) % 233280;
      return seedValue / 233280;
    }

    // Generate ground objects
    const groundObjects = this.objectGenerator.generateChunkObjects(chunk, biome, terrainChunk, r);
    
    // Generate flying creatures
    const flyingCreatures = this.flyingCreaturesGenerator.generateCreaturesForChunk(chunk, biome, terrainChunk, r);

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
}
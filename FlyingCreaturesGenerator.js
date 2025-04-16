import { FlyingCreature } from './flyingCreatures.js';

export class FlyingCreaturesGenerator {
  constructor(scene, biomeManager) {
    this.scene = scene;
    this.biomeManager = biomeManager;
  }
  
  generateCreaturesForChunk(chunk, biome, terrainChunk, r) {
    const flyingCreatures = [];
    
    // Get appropriate flying creature types for this biome
    const flyingTypes = this.biomeManager.getFlyingCreatureTypesForBiome(biome);
    
    // Generate 3-5 flying creatures per chunk
    const flyingCount = 3 + Math.floor(r() * 3);
    for (let i = 0; i < flyingCount; i++) {
      const type = flyingTypes[Math.floor(r() * flyingTypes.length)];
      
      // Position within chunk bounds
      const x = (chunk.x * terrainChunk.chunkSize) + r() * terrainChunk.chunkSize;
      const z = (chunk.z * terrainChunk.chunkSize) + r() * terrainChunk.chunkSize;
      
      // Position above terrain with some variation in height
      const y = terrainChunk.getHeightAt(x, z) + 15 + r() * 35;
      
      const position = new THREE.Vector3(x, y, z);
      const creature = new FlyingCreature(this.scene, type, position);
      flyingCreatures.push(creature);
    }
    
    return flyingCreatures;
  }
}
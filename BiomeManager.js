export class BiomeManager {
  constructor(noiseGenerator) {
    this.noiseGenerator = noiseGenerator;
    this.initBiomes();
  }

  initBiomes() {
    // Biome types with their properties
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
  }

  getBiomeForPosition(x, z) {
    // Use noise to determine the biome type
    // Use a different seed (by using z as third param) to separate biome from terrain noise
    const noiseValue = this.noiseGenerator.noise(x, z, 123.456);
    
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

  getFlyingCreatureTypesForBiome(biome) {
    if (biome === this.biomes.FOREST) {
      return ['butterfly', 'bee', 'bird'];
    } else if (biome === this.biomes.DESERT) {
      return ['eagle', 'vulture', 'dragonfly'];
    } else if (biome === this.biomes.MOUNTAINS) {
      return ['eagle', 'hawk', 'bat'];
    } else if (biome === this.biomes.SNOW) {
      return ['snowbird', 'owl', 'hawk'];
    } else {
      // Default/city biome
      return ['butterfly', 'eagle', 'bee'];
    }
  }
}
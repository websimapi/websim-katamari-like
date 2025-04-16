export class TerrainChunk {
  constructor(scene, world, physicsManager, chunkX, chunkZ, chunkSize, biome, noiseFunction) {
    this.scene = scene;
    this.world = world;
    this.physicsManager = physicsManager;
    this.chunkX = chunkX;
    this.chunkZ = chunkZ;
    this.chunkSize = chunkSize;
    this.biome = biome;
    this.noiseFunction = noiseFunction;
    
    // The resolution of the terrain mesh (number of vertices per side)
    this.resolution = 32;
    
    // Store the heightmap data for collision queries
    this.heightData = new Float32Array(this.resolution * this.resolution);
    
    this.createTerrain();
  }
  
  createTerrain() {
    // Create a plane geometry for the terrain with higher resolution
    const geometry = new THREE.PlaneGeometry(
      this.chunkSize,
      this.chunkSize,
      this.resolution - 1,
      this.resolution - 1
    );
    
    // Rotate to be flat on XZ plane
    geometry.rotateX(-Math.PI / 2);
    
    // Get vertices and modify them with noise
    const worldX = this.chunkX * this.chunkSize;
    const worldZ = this.chunkZ * this.chunkSize;
    
    // Apply height modifications
    const vertices = geometry.attributes.position.array;
    for (let i = 0, j = 0; i < vertices.length; i += 3, j++) {
      // Get the x and z coordinates in world space - use absolute world coordinates for seamless chunks
      const x = vertices[i] + worldX;
      const z = vertices[i+2] + worldZ;
      
      // Generate height using noise function - CRITICAL: using absolute world coordinates for seamless terrain
      const elevation = this.getElevation(x, z);
      
      // Store in our heightmap data array
      this.heightData[j] = elevation;
      
      // Set the y-coordinate (height)
      vertices[i+1] = elevation;
    }
    
    // Update the geometry
    geometry.computeVertexNormals();
    
    // Create material based on biome
    const material = new THREE.MeshPhongMaterial({
      color: this.biome.color,
      flatShading: false // Smooth shading for better terrain appearance
    });
    
    // Main terrain mesh
    this.mesh = new THREE.Mesh(geometry, material);
    this.mesh.receiveShadow = true;
    
    // Position the mesh at the exact world position to avoid seams
    this.mesh.position.set(
      worldX,
      0,
      worldZ
    );
    this.scene.add(this.mesh);
    
    // Create physics for the terrain and register the material
    const terrainMaterial = this.createTerrainPhysics();
    if (terrainMaterial && this.physicsManager) {
      this.physicsManager.addTerrainMaterial(terrainMaterial);
    }
  }
  
  createTerrainPhysics() {
    // Create a heightfield shape for physics
    const heightfieldShape = new CANNON.Heightfield(
      this.reshapeHeightData(),
      {
        elementSize: this.chunkSize / (this.resolution - 1)
      }
    );
    
    // Create a body for the terrain
    this.body = new CANNON.Body({
      mass: 0, // Static body
      shape: heightfieldShape
    });
    
    // Position the body correctly - CRITICAL for proper alignment
    const worldX = this.chunkX * this.chunkSize;
    const worldZ = this.chunkZ * this.chunkSize;
    
    // Position the heightfield - note that heightfield is centered on its local origin
    // This alignment is crucial for seamless terrain chunks
    this.body.position.set(
      worldX + this.chunkSize/2,
      0,
      worldZ + this.chunkSize/2
    );
    
    // Rotate the heightfield to align with our coordinate system
    this.body.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2);
    
    // Add the body to the physics world
    this.world.addBody(this.body);
    
    // Create a material for the terrain surface
    const terrainMaterial = new CANNON.Material('terrain');
    this.body.material = terrainMaterial;
    
    // Return the terrain material so it can be used for creating contact pairs
    return terrainMaterial;
  }
  
  // Reshape the height data for Cannon.js heightfield
  reshapeHeightData() {
    // Cannon.js expects a 2D array for heightfields
    const data = [];
    for (let i = 0; i < this.resolution; i++) {
      const row = [];
      for (let j = 0; j < this.resolution; j++) {
        row.push(this.heightData[i * this.resolution + j]);
      }
      data.push(row);
    }
    return data;
  }
  
  getElevation(x, z) {
    // Get the base elevation from the noise function
    // This function now uses absolute world coordinates
    const noiseValue = this.noiseFunction(x, z);
    
    // Apply biome-specific elevation range
    const elevation = this.biome.elevation.min + 
                     (noiseValue + 1) / 2 * 
                     (this.biome.elevation.max - this.biome.elevation.min);
    
    // Add more detail with additional noise layers
    const detailNoise = this.getDetailNoise(x, z) * this.biome.roughness;
    
    return elevation + detailNoise;
  }
  
  getDetailNoise(x, z) {
    // Add smaller scale noise for terrain details
    // Using absolute world coordinates for seamless chunks
    const scale1 = 0.1;
    const scale2 = 0.05;
    const scale3 = 0.025;
    
    const noise1 = Math.sin(x * scale1) * Math.cos(z * scale1) * 1.0;
    const noise2 = Math.sin(x * scale2) * Math.cos(z * scale2) * 0.5;
    const noise3 = Math.sin(x * scale3) * Math.cos(z * scale3) * 0.25;
    
    return noise1 + noise2 + noise3;
  }
  
  // Get the height at any world position within this chunk
  getHeightAt(x, z) {
    // Convert world coordinates to local chunk coordinates
    const localX = x - (this.chunkX * this.chunkSize);
    const localZ = z - (this.chunkZ * this.chunkSize);
    
    // Ensure coordinates are within chunk bounds
    if (localX < 0 || localX >= this.chunkSize || localZ < 0 || localZ >= this.chunkSize) {
      // For points outside chunk, return closest edge point
      const clampedX = Math.max(0, Math.min(localX, this.chunkSize - 0.001));
      const clampedZ = Math.max(0, Math.min(localZ, this.chunkSize - 0.001));
      
      // Convert to normalized coordinates (0-1 across the chunk)
      const normalizedX = clampedX / this.chunkSize;
      const normalizedZ = clampedZ / this.chunkSize;
      
      // Continue with sampling using clamped coordinates
      const xIndex = Math.floor(normalizedX * (this.resolution - 1));
      const zIndex = Math.floor(normalizedZ * (this.resolution - 1));
      
      // Bilinear interpolation for smooth height transitions
      const xFrac = (normalizedX * (this.resolution - 1)) - xIndex;
      const zFrac = (normalizedZ * (this.resolution - 1)) - zIndex;
      
      const h00 = this.heightData[zIndex * this.resolution + xIndex];
      const h10 = this.heightData[zIndex * this.resolution + xIndex + 1];
      const h01 = this.heightData[(zIndex + 1) * this.resolution + xIndex];
      const h11 = this.heightData[(zIndex + 1) * this.resolution + xIndex + 1];
      
      return h00 * (1 - xFrac) * (1 - zFrac) +
             h10 * xFrac * (1 - zFrac) +
             h01 * (1 - xFrac) * zFrac +
             h11 * xFrac * zFrac;
    }
    
    // Convert to normalized coordinates (0-1 across the chunk)
    const normalizedX = localX / this.chunkSize;
    const normalizedZ = localZ / this.chunkSize;
    
    // Convert to array indices
    let xIndex = Math.floor(normalizedX * (this.resolution - 1));
    let zIndex = Math.floor(normalizedZ * (this.resolution - 1));
    
    // Clamp indices to valid range
    xIndex = Math.max(0, Math.min(xIndex, this.resolution - 2));
    zIndex = Math.max(0, Math.min(zIndex, this.resolution - 2));
    
    // Calculate fractional position within the grid cell
    const xFrac = (normalizedX * (this.resolution - 1)) - xIndex;
    const zFrac = (normalizedZ * (this.resolution - 1)) - zIndex;
    
    // Get heights at the four corners of the grid cell
    const h00 = this.heightData[zIndex * this.resolution + xIndex];
    const h10 = this.heightData[zIndex * this.resolution + xIndex + 1];
    const h01 = this.heightData[(zIndex + 1) * this.resolution + xIndex];
    const h11 = this.heightData[(zIndex + 1) * this.resolution + xIndex + 1];
    
    // Bilinear interpolation to get the height at the exact position
    const height = h00 * (1 - xFrac) * (1 - zFrac) +
                  h10 * xFrac * (1 - zFrac) +
                  h01 * (1 - xFrac) * zFrac +
                  h11 * xFrac * zFrac;
    
    return height;
  }
  
  dispose() {
    if (this.mesh) {
      if (this.mesh.geometry) this.mesh.geometry.dispose();
      if (this.mesh.material) {
        if (Array.isArray(this.mesh.material)) {
          this.mesh.material.forEach(mat => mat && mat.dispose());
        } else if (this.mesh.material) {
          this.mesh.material.dispose();
        }
      }
      this.scene.remove(this.mesh);
    }
    
    if (this.body) {
      this.world.removeBody(this.body);
    }
  }
}
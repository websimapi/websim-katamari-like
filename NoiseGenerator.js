export class NoiseGenerator {
  constructor() {
    this.initPerlinNoise();
  }

  // Initialize Perlin noise with permutation tables and gradients
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
}
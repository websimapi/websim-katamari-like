import { FlyingCreature } from './flyingCreatures.js';
import { Human } from './Human.js';

export class CityGenerator {
  constructor(scene, world) {
    this.scene = scene;
    this.world = world;
    this.chunkSize = 100; // Size of the chunk in world units
    this.loadedChunks = new Set();
    // Map structure: key -> { ground: Array of objects, flying: Array of creatures }
    this.objects = new Map();
    
    this.setupCommonMaterials();
  }

  setupCommonMaterials() {
    this.materials = {
      wood: new THREE.MeshStandardMaterial({ color: 0x8B4513, roughness: 0.9, metalness: 0.1 }),
      leaves: new THREE.MeshStandardMaterial({ color: 0x228B22, roughness: 0.8, metalness: 0.0 }),
      stone: new THREE.MeshStandardMaterial({ color: 0x808080, roughness: 0.6, metalness: 0.2 }),
      metal: new THREE.MeshStandardMaterial({ color: 0xAAAAAA, roughness: 0.3, metalness: 0.8 }),
      emissive: new THREE.MeshStandardMaterial({ color: 0xFFFFE0, emissive: 0xFFFFE0, emissiveIntensity: 2.0 }),
      plastic: new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.4, metalness: 0.1 }),
      asphalt: new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.9, metalness: 0.0 }),
      concrete: new THREE.MeshStandardMaterial({ color: 0x999999, roughness: 0.8, metalness: 0.1 }),
      glass: new THREE.MeshStandardMaterial({ color: 0x88ccff, roughness: 0.1, metalness: 0.9, transparent: true, opacity: 0.7 })
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

  updateAnimations(time, delta) {
    this.objects.forEach(chunkData => {
      if (chunkData.flying) {
        chunkData.flying.forEach(c => c.update(time));
      }
      if (chunkData.ground) {
        chunkData.ground.forEach(obj => {
          if (obj.instance && typeof obj.instance.update === 'function') {
            obj.instance.update(time, delta);
          }
        });
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
    const groundObjects = [];
    const flyingCreatures = [];
    
    // Deterministic random
    let seedValue = (((chunk.x + 1000) * 10000) + (chunk.z + 1000)) % 233280;
    function r() {
      seedValue = (seedValue * 9301 + 49297) % 233280;
      return seedValue / 233280;
    }

    const chunkWorldX = chunk.x * this.chunkSize;
    const chunkWorldZ = chunk.z * this.chunkSize;

    // Grid System for Roads
    const roadWidth = 14;
    const sidewalkWidth = 4;
    const blockSize = 50; // Distance between road centers
    
    // Helper to check if a position is on a road or sidewalk
    const getZone = (bx, bz) => {
      // Normalize coords within the repeating block pattern
      // Offset by chunk position to align global grid
      const gx = chunkWorldX + bx;
      const gz = chunkWorldZ + bz;
      
      const rx = Math.abs(gx % blockSize);
      const rz = Math.abs(gz % blockSize);
      
      const inRoadX = rx < roadWidth;
      const inRoadZ = rz < roadWidth;
      
      if (inRoadX || inRoadZ) return 'road';
      
      const inWalkX = rx < roadWidth + sidewalkWidth;
      const inWalkZ = rz < roadWidth + sidewalkWidth;
      
      if (inWalkX || inWalkZ) return 'sidewalk';
      
      return 'building';
    };

    // Generate Roads and Sidewalks (Visual Only - physics handled by ground plane mostly, but we can add curbs)
    // We'll create one big mesh for roads/sidewalks per chunk to optimize, or individual tiles.
    // For simplicity, let's place objects.
    
    // Place Roads tiles
    const tileStep = 10;
    for (let x = 0; x < this.chunkSize; x += tileStep) {
      for (let z = 0; z < this.chunkSize; z += tileStep) {
        const zone = getZone(x + tileStep/2, z + tileStep/2);
        const posX = chunkWorldX + x + tileStep/2;
        const posZ = chunkWorldZ + z + tileStep/2;
        
        let mat = null;
        let yOff = 0.05;
        
        if (zone === 'road') {
          mat = this.materials.asphalt;
        } else if (zone === 'sidewalk') {
          mat = this.materials.concrete;
          yOff = 0.2; // Curb height
        }
        
        if (mat) {
            const plane = new THREE.Mesh(new THREE.PlaneGeometry(tileStep, tileStep), mat);
            plane.rotation.x = -Math.PI/2;
            plane.position.set(posX, yOff, posZ);
            plane.receiveShadow = true;
            this.scene.add(plane);
            // Track tile to remove later
            groundObjects.push({ mesh: plane, body: { mass: 0 } }); // Dummy body for disposal logic
        }
      }
    }

    // Place Buildings and Objects
    const placedBuildings = [];
    
    // Helper to validate building placement
    const isValidBuildingSpot = (bx, bz, width) => {
        const half = width / 2;
        // Check corners against road/sidewalk zones
        const corners = [
            { x: bx - half, z: bz - half },
            { x: bx + half, z: bz - half },
            { x: bx + half, z: bz + half },
            { x: bx - half, z: bz + half },
            { x: bx, z: bz }
        ];
        
        for (const p of corners) {
            // Ensure strictly inside building zone (no road/sidewalk overlap)
            if (getZone(p.x, p.z) !== 'building') return false;
        }
        
        // Check overlap with existing buildings (AABB)
        const margin = 2; // Buffer space
        for (const b of placedBuildings) {
            const dx = Math.abs(bx - b.x);
            const dz = Math.abs(bz - b.z);
            const safeDist = (width/2) + (b.w/2) + margin;
            
            if (dx < safeDist && dz < safeDist) return false;
        }
        return true;
    };

    // 1. Buildings (In Building Zones)
    const numBuildings = 5 + Math.floor(r() * 5);
    for(let i=0; i<numBuildings; i++) {
        let placed = false;
        let attempts = 0;
        
        // Retry logic to find valid spot
        while (!placed && attempts < 20) {
            attempts++;
            const bx = r() * this.chunkSize;
            const bz = r() * this.chunkSize;
            
            const isSkyscraper = r() > 0.6;
            const width = isSkyscraper ? 10 + r()*10 : 8 + r()*8;
            const height = isSkyscraper ? 40 + r()*60 : 8 + r()*15;
            
            if (isValidBuildingSpot(bx, bz, width)) {
                const posX = chunkWorldX + bx;
                const posZ = chunkWorldZ + bz;
                
                this.createBuilding(posX, posZ, width, height, isSkyscraper, groundObjects);
                placedBuildings.push({ x: bx, z: bz, w: width });
                placed = true;
            }
        }
    }
    
    // 2. Humans (On Sidewalks)
    const numHumans = 5 + Math.floor(r() * 5);
    for(let i=0; i<numHumans; i++) {
        for(let attempt=0; attempt<10; attempt++) {
            const hx = r() * this.chunkSize;
            const hz = r() * this.chunkSize;
            if (getZone(hx, hz) === 'sidewalk') {
                const posX = chunkWorldX + hx;
                const posZ = chunkWorldZ + hz;
                const human = new Human(this.scene, this.world, new THREE.Vector3(posX, 0, posZ));
                groundObjects.push({ mesh: human.mesh, body: human.body, instance: human });
                break;
            }
        }
    }

    // 3. Street Props (Lamps, Benches on Sidewalks)
    for(let i=0; i<8; i++) {
        const lx = r() * this.chunkSize;
        const lz = r() * this.chunkSize;
        if (getZone(lx, lz) === 'sidewalk') {
             const posX = chunkWorldX + lx;
             const posZ = chunkWorldZ + lz;
             this.createLamp(posX, posZ, groundObjects);
        }
    }
    
    // 4. Random Junk/Collectibles (Anywhere)
    for(let i=0; i<30; i++) {
        const jx = r() * this.chunkSize;
        const jz = r() * this.chunkSize;
        const posX = chunkWorldX + jx;
        const posZ = chunkWorldZ + jz;
        this.createCollectible(posX, posZ, r, groundObjects);
    }
    
    // Flying Creatures
    const flyingTypes = ['butterfly', 'eagle', 'bee'];
    const flyingCount = 3 + Math.floor(r() * 3);
    for (let i = 0; i < flyingCount; i++) {
      const type = flyingTypes[Math.floor(r() * flyingTypes.length)];
      const x = chunkWorldX + r() * this.chunkSize;
      const z = chunkWorldZ + r() * this.chunkSize;
      const y = 15 + r() * 35;
      const position = new THREE.Vector3(x, y, z);
      const creature = new FlyingCreature(this.scene, type, position);
      flyingCreatures.push(creature);
    }

    this.objects.set(`${chunk.x},${chunk.z}`, { ground: groundObjects, flying: flyingCreatures });
  }

  createBuilding(x, z, width, height, isSky, list) {
    const group = new THREE.Group();
    group.position.set(x, height/2, z);
    
    // Main structure
    const mat = isSky ? this.materials.glass : this.materials.stone;
    const geo = new THREE.BoxGeometry(width, height, width);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    group.add(mesh);
    
    // Details
    if (!isSky) {
        // Residential/House look
        // Roof
        const roofGeo = new THREE.ConeGeometry(width * 0.8, width/2, 4);
        const roof = new THREE.Mesh(roofGeo, this.materials.wood);
        roof.position.y = height/2 + width/4;
        roof.rotation.y = Math.PI/4;
        group.add(roof);
    } else {
        // Skyscraper details
        // Random trim
        const trimGeo = new THREE.BoxGeometry(width + 1, height/10, width + 1);
        for(let i=0; i<height; i+=height/5) {
             const trim = new THREE.Mesh(trimGeo, this.materials.metal);
             trim.position.y = i - height/2;
             group.add(trim);
        }
    }

    // Windows
    // Simple textured look via small meshes
    if (!isSky) {
        const winGeo = new THREE.BoxGeometry(0.5, 1, 0.1);
        const winMat = this.materials.emissive;
        for(let wy = -height/2 + 2; wy < height/2 - 2; wy += 3) {
            for(let wx = -width/2 + 2; wx < width/2; wx += 3) {
                const w1 = new THREE.Mesh(winGeo, winMat);
                w1.position.set(wx, wy, width/2 + 0.1);
                group.add(w1);
            }
        }
    }
    
    group.userData.itemName = isSky ? "Skyscraper" : "House";
    this.scene.add(group);
    
    const shape = new CANNON.Box(new CANNON.Vec3(width/2, height/2, width/2));
    const body = new CANNON.Body({
        mass: width * height * 10,
        shape: shape,
        position: new CANNON.Vec3(x, height/2, z)
    });
    this.world.addBody(body);
    
    list.push({ mesh: group, body });
  }

  createLamp(x, z, list) {
     const height = 6;
     const group = new THREE.Group();
     group.position.set(x, 0, z);
     
     const pole = new THREE.Mesh(
         new THREE.CylinderGeometry(0.2, 0.2, height),
         this.materials.metal
     );
     pole.position.y = height/2;
     pole.castShadow = true;
     group.add(pole);
     
     const head = new THREE.Mesh(
         new THREE.BoxGeometry(1, 0.2, 0.5),
         this.materials.metal
     );
     head.position.set(0.3, height, 0);
     group.add(head);
     
     const light = new THREE.Mesh(
         new THREE.SphereGeometry(0.3),
         this.materials.emissive
     );
     light.position.set(0.6, height - 0.2, 0);
     group.add(light);
     
     group.userData.itemName = "Street Lamp";
     this.scene.add(group);
     
     // Physics
     const body = new CANNON.Body({
         mass: 20,
         shape: new CANNON.Cylinder(0.2, 0.2, height, 8),
         position: new CANNON.Vec3(x, height/2, z)
     });
      const q = new CANNON.Quaternion();
      q.setFromAxisAngle(new CANNON.Vec3(1,0,0),-Math.PI/2);
      body.quaternion.set(q.x, q.y, q.z, q.w);

     this.world.addBody(body);
     list.push({ mesh: group, body });
  }

  createCollectible(x, z, r, list) {
     const size = 0.5 + r();
     let mesh, shape, mass;
     const type = r();
     
     if (type < 0.3) {
         // Box
         mesh = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff }));
         mesh.userData.itemName = "Box";
         shape = new CANNON.Box(new CANNON.Vec3(size/2, size/2, size/2));
         mass = size * 5;
     } else if (type < 0.6) {
         // Ball
         mesh = new THREE.Mesh(new THREE.SphereGeometry(size/2), new THREE.MeshStandardMaterial({ color: Math.random() * 0xffffff }));
         mesh.userData.itemName = "Ball";
         shape = new CANNON.Sphere(size/2);
         mass = size * 5;
     } else {
         // Cone/Traffic Cone
         mesh = new THREE.Mesh(new THREE.ConeGeometry(size/2, size, 16), new THREE.MeshStandardMaterial({ color: 0xff6600 }));
         mesh.userData.itemName = "Cone";
         shape = new CANNON.Cylinder(0.01, size/2, size, 8);
         mass = size * 2;
     }
     
     mesh.position.set(x, size/2, z);
     mesh.castShadow = true;
     mesh.receiveShadow = true;
     this.scene.add(mesh);
     
     const body = new CANNON.Body({
         mass: mass,
         shape: shape,
         position: new CANNON.Vec3(x, size/2, z)
     });
     // Orient cone if needed
     if (type >= 0.6) {
         const q = new CANNON.Quaternion();
         q.setFromAxisAngle(new CANNON.Vec3(1,0,0),-Math.PI/2);
         body.quaternion.set(q.x, q.y, q.z, q.w);
     }
     
     this.world.addBody(body);
     list.push({ mesh, body });
  }

  removeChunk(chunk) {
    const key = `${chunk.x},${chunk.z}`;
    const chunkData = this.objects.get(key);
    if (chunkData) {
      // Remove ground objects
      chunkData.ground.forEach(obj => {
        if (obj.mesh) {
            this.scene.remove(obj.mesh);
            // Dispose geometries and materials
            if (obj.mesh.geometry) obj.mesh.geometry.dispose();
             // Simple material dispose check
            if (obj.mesh.material && obj.mesh.material.dispose) obj.mesh.material.dispose();
        }
        if (obj.body && obj.body.mass !== 0) { // Check if not dummy body
             this.world.removeBody(obj.body);
        }
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
            this.scene.remove(obj.mesh);
          }
          if (obj.body) {
            this.world.removeBody(obj.body);
          }
          chunkData.ground.splice(i, 1);
          return;
        }
      }
    });
  }
}
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
      tiny: 25,  // Star Dust count
      medium: 15,
      large: 5,
      buildings: 6,
      unique: 15  // Increased unique object count
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

    // Generate Star Dust in the sky (tiny objects)
    for (let i = 0; i < objectCounts.tiny; i++) {  
      const size = this.minObjectSize + Math.random() * 0.3;
      const pos = getValidPosition(size);
      if (!pos) continue;
      
      const starAltitude = 20 + Math.random() * 10;
      const geometry = geometryPool.sphere.clone();
      geometry.scale(size, size, size);
      const material = getMaterial(0xFFFFFF);
      const mesh = new THREE.Mesh(geometry, material);
      mesh.userData.itemName = "Star Dust";
      mesh.userData.isStarDust = true; // Flag for glow effect
      
      mesh.position.set(pos.x, starAltitude, pos.z);
      this.scene.add(mesh);

      const shape = new CANNON.Sphere(size);
      const body = new CANNON.Body({
        mass: size * 2,
        shape: shape,
        position: new CANNON.Vec3(pos.x, starAltitude, pos.z)
      });
      body.linearDamping = 0.9;
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
    
    // Generate unique objects
    const uniqueTypes = [
      "Carrot", "Frying Pan", "Boat", "Fish", "Number 3", "UFO", 
      "Rubber Duck", "Cupcake", "Sunglasses", "Banana", "Pizza", 
      "Guitar", "Top Hat", "Ice Cream Cone", "Coffee Cup",
      "Umbrella", "Rainbow", "Pencil", "Clock", "Crown"
    ];

    // Load trash bin model
    const loader = new THREE.GLTFLoader();
    loader.load('trash_bin.glb', (gltf) => {
      for (let i = 0; i < 5; i++) {
        const pos = getValidPosition(1);
        if (!pos) continue;
        
        const trashBin = gltf.scene.clone();
        trashBin.scale.set(0.5, 0.5, 0.5);
        trashBin.position.set(pos.x, 0.5, pos.z);
        trashBin.userData.itemName = "Trash Bin";
        this.scene.add(trashBin);

        const shape = new CANNON.Box(new CANNON.Vec3(0.5, 0.75, 0.5));
        const body = new CANNON.Body({
          mass: 5,
          shape: shape,
          position: new CANNON.Vec3(pos.x, 0.75, pos.z)
        });
        this.world.addBody(body);

        objects.push({ mesh: trashBin, body });
      }
    });

    for (let i = 0; i < objectCounts.unique; i++) {
      const size = 1 + Math.random();
      const pos = getValidPosition(size);
      if (!pos) continue;
      const type = uniqueTypes[Math.floor(Math.random() * uniqueTypes.length)];
      const uniqueObject = this.createUniqueObject(type, pos, size);
      if (uniqueObject) {
        objects.push(uniqueObject);
      }
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

  createUniqueObject(type, pos, size) {
    const group = new THREE.Group();
    let width = size * 2, height = size * 2, depth = size * 2;
    if (type === "Carrot") {
      const geometry = new THREE.CylinderGeometry(0.2 * size, 0.5 * size, 2 * size, 8);
      const material = new THREE.MeshPhongMaterial({ color: 0xFFA500, flatShading: true });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.rotation.z = Math.PI / 8;
      group.add(mesh);
      group.userData.itemName = "Carrot";
      height = 2 * size;
      width = 0.5 * size;
      depth = 0.5 * size;
    } else if (type === "Frying Pan") {
      const panGeometry = new THREE.CircleGeometry(0.7 * size, 16);
      const panMaterial = new THREE.MeshPhongMaterial({ color: 0x555555, flatShading: true });
      const panMesh = new THREE.Mesh(panGeometry, panMaterial);
      panMesh.rotation.x = -Math.PI / 2;
      group.add(panMesh);
      const handleGeometry = new THREE.BoxGeometry(0.2 * size, 0.2 * size, 1 * size);
      const handleMaterial = new THREE.MeshPhongMaterial({ color: 0x333333, flatShading: true });
      const handleMesh = new THREE.Mesh(handleGeometry, handleMaterial);
      handleMesh.position.set(0, 0.1 * size, 0.8 * size);
      group.add(handleMesh);
      group.userData.itemName = "Frying Pan";
      height = 0.2 * size;
      width = 1.4 * size;
      depth = 1 * size;
    } else if (type === "Boat") {
      const hullGeometry = new THREE.BoxGeometry(1.5 * size, 0.5 * size, 0.7 * size);
      const hullMaterial = new THREE.MeshPhongMaterial({ color: 0x8B4513, flatShading: true });
      const hullMesh = new THREE.Mesh(hullGeometry, hullMaterial);
      hullMesh.position.y = 0.25 * size;
      group.add(hullMesh);
      const sailShape = new THREE.Shape();
      sailShape.moveTo(0, 0);
      sailShape.lineTo(0, 1.5 * size);
      sailShape.lineTo(1 * size, 0.75 * size);
      sailShape.lineTo(0, 0);
      const extrudeSettings = { depth: 0.1 * size, bevelEnabled: false };
      const sailGeometry = new THREE.ExtrudeGeometry(sailShape, extrudeSettings);
      const sailMaterial = new THREE.MeshPhongMaterial({ color: 0xFFFFFF, flatShading: true });
      const sailMesh = new THREE.Mesh(sailGeometry, sailMaterial);
      sailMesh.position.set(0.5 * size, 0.5 * size, 0);
      sailMesh.rotation.y = -Math.PI / 8;
      group.add(sailMesh);
      group.userData.itemName = "Boat";
      height = 0.5 * size;
      width = 1.5 * size;
      depth = 0.7 * size;
    } else if (type === "Fish") {
      const bodyGeometry = new THREE.SphereGeometry(0.5 * size, 8, 8);
      bodyGeometry.scale(1.5, 1, 1);
      const bodyMaterial = new THREE.MeshPhongMaterial({ color: 0x00FFFF, flatShading: true });
      const bodyMesh = new THREE.Mesh(bodyGeometry, bodyMaterial);
      group.add(bodyMesh);
      const tailShape = new THREE.Shape();
      tailShape.moveTo(0, 0);
      tailShape.lineTo(-0.5 * size, 0.3 * size);
      tailShape.lineTo(-0.5 * size, -0.3 * size);
      tailShape.lineTo(0, 0);
      const tailGeometry = new THREE.ExtrudeGeometry(tailShape, { depth: 0.1 * size, bevelEnabled: false });
      const tailMaterial = new THREE.MeshPhongMaterial({ color: 0x00FFFF, flatShading: true });
      const tailMesh = new THREE.Mesh(tailGeometry, tailMaterial);
      tailMesh.position.set(-0.75 * size, 0, 0);
      group.add(tailMesh);
      group.userData.itemName = "Fish";
      height = 0.5 * size;
      width = 1 * size;
      depth = 0.5 * size;
    } else if (type === "Number 3") {
      const torusGeometry1 = new THREE.TorusGeometry(0.4 * size, 0.1 * size, 8, 16, Math.PI);
      const torusMaterial = new THREE.MeshPhongMaterial({ color: 0xFF69B4, flatShading: true });
      const torus1 = new THREE.Mesh(torusGeometry1, torusMaterial);
      torus1.rotation.x = Math.PI / 2;
      torus1.position.set(0, 0.4 * size, 0);
      group.add(torus1);
      const torusGeometry2 = new THREE.TorusGeometry(0.4 * size, 0.1 * size, 8, 16, Math.PI);
      const torus2 = new THREE.Mesh(torusGeometry2, torusMaterial);
      torus2.rotation.x = Math.PI / 2;
      torus2.position.set(0, -0.4 * size, 0);
      group.add(torus2);
      group.userData.itemName = "Number 3";
      height = 0.8 * size;
      width = 0.8 * size;
      depth = 0.2 * size;
    } else if (type === "UFO") {
      const discGeometry = new THREE.CylinderGeometry(size, size, size * 0.2, 32);
      const discMaterial = new THREE.MeshPhongMaterial({ color: 0xaaaaaa, flatShading: true });
      const discMesh = new THREE.Mesh(discGeometry, discMaterial);
      group.add(discMesh);
      const domeGeometry = new THREE.SphereGeometry(size * 0.6, 16, 16, 0, Math.PI);
      const domeMaterial = new THREE.MeshPhongMaterial({ color: 0x8888ff, flatShading: true });
      const domeMesh = new THREE.Mesh(domeGeometry, domeMaterial);
      domeMesh.position.y = size * 0.2;
      group.add(domeMesh);
      group.userData.itemName = "UFO";
      width = size * 2;
      height = size;
      depth = size * 2;
    } else if (type === "Rubber Duck") {
      const bodyGeo = new THREE.SphereGeometry(size * 0.5, 16, 16);
      const bodyMat = new THREE.MeshPhongMaterial({ color: 0xffff00, flatShading: true });
      const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
      group.add(bodyMesh);
      const beakGeo = new THREE.ConeGeometry(size * 0.2, size * 0.4, 16);
      const beakMat = new THREE.MeshPhongMaterial({ color: 0xffa500, flatShading: true });
      const beakMesh = new THREE.Mesh(beakGeo, beakMat);
      beakMesh.rotation.z = Math.PI / 2;
      beakMesh.position.set(size * 0.5, 0, 0);
      group.add(beakMesh);
      group.userData.itemName = "Rubber Duck";
      width = size;
      height = size;
      depth = size;
    } else if (type === "Cupcake") {
      const baseGeo = new THREE.CylinderGeometry(size * 0.5, size * 0.5, size, 16);
      const baseMat = new THREE.MeshPhongMaterial({ color: 0xd2b48c, flatShading: true });
      const baseMesh = new THREE.Mesh(baseGeo, baseMat);
      baseMesh.position.y = size * 0.5;
      group.add(baseMesh);
      const icingGeo = new THREE.ConeGeometry(size * 0.6, size, 16);
      const icingMat = new THREE.MeshPhongMaterial({ color: 0xffc0cb, flatShading: true });
      const icingMesh = new THREE.Mesh(icingGeo, icingMat);
      icingMesh.position.y = size * 1.1;
      group.add(icingMesh);
      group.userData.itemName = "Cupcake";
      width = size;
      height = size * 2;
      depth = size;
    } else if (type === "Sunglasses") {
      const leftGlass = new THREE.BoxGeometry(size * 0.5, size * 0.2, size * 0.1);
      const rightGlass = new THREE.BoxGeometry(size * 0.5, size * 0.2, size * 0.1);
      const glassMat = new THREE.MeshPhongMaterial({ color: 0x000000, flatShading: true });
      const leftMesh = new THREE.Mesh(leftGlass, glassMat);
      const rightMesh = new THREE.Mesh(rightGlass, glassMat);
      leftMesh.position.set(-size * 0.3, 0, 0);
      rightMesh.position.set(size * 0.3, 0, 0);
      group.add(leftMesh);
      group.add(rightMesh);
      group.userData.itemName = "Sunglasses";
      width = size;
      height = size * 0.5;
      depth = size;
    } else if (type === "Banana") {
      const curve = new THREE.CatmullRomCurve3([
        new THREE.Vector3(-size, 0, 0),
        new THREE.Vector3(-size/2, size/2, 0),
        new THREE.Vector3(size/2, size/2, 0),
        new THREE.Vector3(size, 0, 0)
      ]);
      const geometry = new THREE.TubeGeometry(curve, 20, size * 0.1, 8, false);
      const material = new THREE.MeshPhongMaterial({ color: 0xffff00, flatShading: true });
      const mesh = new THREE.Mesh(geometry, material);
      group.add(mesh);
      group.userData.itemName = "Banana";
      width = size * 2;
      height = size;
      depth = size;
    } else if (type === "Pizza") {
      const baseGeo = new THREE.CylinderGeometry(size, size, size * 0.1, 8);
      const baseMat = new THREE.MeshPhongMaterial({ color: 0xFFA07A });
      const base = new THREE.Mesh(baseGeo, baseMat);
      group.add(base);
      group.userData.itemName = "Pizza";
    } else if (type === "Guitar") {
      const bodyGeo = new THREE.BoxGeometry(size * 0.8, size * 0.2, size * 2);
      const neckGeo = new THREE.BoxGeometry(size * 0.2, size * 0.1, size);
      const bodyMat = new THREE.MeshPhongMaterial({ color: 0x8B4513 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      const neck = new THREE.Mesh(neckGeo, bodyMat);
      neck.position.z = -size * 1.5;
      group.add(body);
      group.add(neck);
      group.userData.itemName = "Guitar";
    } else if (type === "Top Hat") {
      const brimGeo = new THREE.CylinderGeometry(size * 0.8, size * 0.8, size * 0.1, 32);
      const topGeo = new THREE.CylinderGeometry(size * 0.6, size * 0.6, size, 32);
      const hatMat = new THREE.MeshPhongMaterial({ color: 0x000000 });
      const brim = new THREE.Mesh(brimGeo, hatMat);
      const top = new THREE.Mesh(topGeo, hatMat);
      top.position.y = size * 0.5;
      group.add(brim);
      group.add(top);
      group.userData.itemName = "Top Hat";
    }
    group.position.set(pos.x, (height / 2), pos.z);
    const shape = new CANNON.Box(new CANNON.Vec3(width / 2, height / 2, depth / 2));
    const body = new CANNON.Body({
      mass: 5 * size,
      shape: shape,
      position: new CANNON.Vec3(pos.x, (height / 2), pos.z)
    });
    this.world.addBody(body);
    return { mesh: group, body: body };
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
export class MultiplayerManager {
  constructor(game) {
    this.game = game;
    this.scene = game.scene;
    this.world = game.world;
    this.player = game.player;
    
    // Initialize Multiplayer Lobby
    this.room = new WebsimSocket();
    
    // Dictionary for remote players' 3D representations
    this.peerPlayers = {};  
    
    // Dictionary for remote players' physics bodies for proper collision simulation
    this.peerBodies = {};
    
    this.lastSentPosition = 0;
    
    this.setupMultiplayer();
  }

  setupMultiplayer() {
    // Handle incoming messages for peer ball updates, disconnections, and pickup removals
    this.room.onmessage = (event) => {
      if (!event || !event.data) return;
      
      const data = event.data;
      switch (data.type) {
        // When receiving ball updates, we create/update a remote physics body
        case "ball-update":
          // Ignore our own ball updates
          if (data.clientId === this.room.party.client.id) return;
          
          // Validate key properties in the update data
          if (!data.position || !data.quaternion) return;
          
          // If we haven't seen this peer yet, create a detailed ball representation along with a physics body.
          if (!this.peerPlayers[data.clientId]) {
            const group = new THREE.Group();
            // Create main ball mesh reflecting radius
            const radius = data.radius || 1;
            const geometry = new THREE.SphereGeometry(radius, 32, 32);
            const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
            const ballMesh = new THREE.Mesh(geometry, material);
            ballMesh.castShadow = true;
            group.add(ballMesh);
            group.userData.mainBallMesh = ballMesh;
            // Add attachments as simple spheres
            if (data.attachedData) {
              data.attachedData.forEach(attachment => {
                if (!attachment || !attachment.direction) return;
                const attGeom = new THREE.SphereGeometry(0.1, 8, 8);
                const attMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const attMesh = new THREE.Mesh(attGeom, attMat);
                attMesh.position.set(
                  attachment.direction.x * radius,
                  attachment.direction.y * radius,
                  attachment.direction.z * radius
                );
                group.add(attMesh);
              });
            }
            this.scene.add(group);
            this.peerPlayers[data.clientId] = group;
            
            // Create a Cannon physics body for this remote player so that collisions work.
            const mass = radius * 2; // Simplified mass estimation.
            const shape = new CANNON.Sphere(radius);
            const body = new CANNON.Body({
              mass: mass,
              shape: shape,
              position: new CANNON.Vec3(data.position.x, data.position.y, data.position.z)
            });
            // Initialize with received quaternion.
            body.quaternion.set(data.quaternion.x, data.quaternion.y, data.quaternion.z, data.quaternion.w);
            this.world.addBody(body);
            this.peerBodies[data.clientId] = body;
          } else {
            // Update existing peer ball (both 3D group and physics body)
            const group = this.peerPlayers[data.clientId];
            const body = this.peerBodies[data.clientId];
            
            if (!group || !body) return;
            
            const targetPos = new CANNON.Vec3(data.position.x, data.position.y, data.position.z);
            // Compute velocity update based on difference (assuming network updates roughly every 100ms)
            const velocityFactor = 10; // 1/0.1 sec approximation
            const deltaPos = targetPos.vsub(body.position);
            body.velocity.set(
              deltaPos.x * velocityFactor,
              deltaPos.y * velocityFactor,
              deltaPos.z * velocityFactor
            );
            // Smoothly update rotation as well.
            body.quaternion.set(data.quaternion.x, data.quaternion.y, data.quaternion.z, data.quaternion.w);
            
            // If radius has changed, update collision shape and the main mesh geometry.
            if (body.shapes[0] && body.shapes[0].radius !== data.radius) {
              // Remove old shape and add new shape with updated radius.
              body.shapes = [];
              const newShape = new CANNON.Sphere(data.radius);
              body.addShape(newShape);
              // Update mass proportionally (approximation)
              body.mass = data.radius * 2;
              body.updateMassProperties();
              
              // Update main ball mesh geometry.
              if (group.userData && group.userData.mainBallMesh) {
                const mainBallMesh = group.userData.mainBallMesh;
                if (mainBallMesh.geometry) {
                  mainBallMesh.geometry.dispose();
                  mainBallMesh.geometry = new THREE.SphereGeometry(data.radius, 32, 32);
                }
              }
            }
            
            // Update attachments: remove existing attachments except the main ball mesh.
            while (group.children.length > 1) {
              const child = group.children[1];
              group.remove(child);
              if (child.geometry) child.geometry.dispose();
              if (child.material) child.material.dispose();
            }
            if (data.attachedData) {
              data.attachedData.forEach(attachment => {
                if (!attachment || !attachment.direction) return;
                const attGeom = new THREE.SphereGeometry(0.1, 8, 8);
                const attMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                const attMesh = new THREE.Mesh(attGeom, attMat);
                attMesh.position.set(
                  attachment.direction.x * data.radius,
                  attachment.direction.y * data.radius,
                  attachment.direction.z * data.radius
                );
                group.add(attMesh);
              });
            }
          }
          break;
        case "disconnected":
          // Remove disconnected player's mesh and physics body if they exist.
          if (this.peerPlayers[data.clientId]) {
            this.scene.remove(this.peerPlayers[data.clientId]);
            delete this.peerPlayers[data.clientId];
          }
          if (this.peerBodies[data.clientId]) {
            this.world.removeBody(this.peerBodies[data.clientId]);
            delete this.peerBodies[data.clientId];
          }
          break;
        case "object-picked-up":
          // When a peer picks up an object, remove that object from our city as well.
          // This ensures all peers see the same map data.
          if (data.bodyId && this.game.cityGenerator) {
            this.game.cityGenerator.removeObjectByBodyId(data.bodyId);
          }
          break;
        default:
          // Handle other event types if needed
          break;
      }
    };
  }

  updatePeers() {
    // Update remote peer 3D groups from their physics bodies for collision accuracy.
    for (const clientId in this.peerBodies) {
      const body = this.peerBodies[clientId];
      const group = this.peerPlayers[clientId];
      if (group && body && body.position && body.quaternion) {
        group.position.copy(body.position);
        group.quaternion.copy(body.quaternion);
      }
    }
  }

  sendPlayerState(gameState) {
    if (!this.player || !this.player.mesh || !this.player.mesh.position || !this.player.mesh.quaternion) {
      return;
    }
    
    if (performance.now() - this.lastSentPosition > 100) {
      const attachedData = this.player.attachedMeshes.map(att => {
        if (!att || !att.direction || !att.mesh) return null;
        return {
          direction: { x: att.direction.x, y: att.direction.y, z: att.direction.z },
          itemName: att.mesh.userData && att.mesh.userData.itemName || ""
        };
      }).filter(data => data !== null);
      
      this.room.send({
        type: "ball-update",
        position: { 
          x: this.player.mesh.position.x, 
          y: this.player.mesh.position.y, 
          z: this.player.mesh.position.z 
        },
        quaternion: { 
          x: this.player.mesh.quaternion.x, 
          y: this.player.mesh.quaternion.y, 
          z: this.player.mesh.quaternion.z, 
          w: this.player.mesh.quaternion.w 
        },
        radius: this.player.radius,
        attachedData: attachedData,
        isDemo: gameState === "TITLE"
      });
      this.lastSentPosition = performance.now();
    }
  }
}
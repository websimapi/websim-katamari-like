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

  async setupMultiplayer() {
    // Initialize the connection
    await this.room.initialize();

    // Subscribe to presence updates (player positions, rotations, etc.)
    this.room.subscribePresence((presence) => {
      // Process updates for all connected players
      Object.keys(presence).forEach(clientId => {
        // Skip our own client's presence
        if (clientId === this.room.clientId) return;
        
        const playerData = presence[clientId];
        if (!playerData) return;

        // Process player update
        this.updateRemotePlayer(clientId, playerData);
      });
    });

    // Subscribe to room state updates (objects in the world)
    this.room.subscribeRoomState((roomState) => {
      // Process collected objects
      if (roomState.collectedObjects) {
        Object.keys(roomState.collectedObjects).forEach(objectId => {
          if (roomState.collectedObjects[objectId] === null) {
            // Object was removed, remove it from our world
            this.game.cityGenerator.removeObjectByBodyId(objectId);
          }
        });
      }
    });

    // Handle presence update requests (e.g., damage)
    this.room.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
      if (updateRequest.type === 'absorb') {
        // If another player is trying to absorb us
        // We need to check if the absorber is actually larger by 10% in mass
        const localMass = Math.pow(this.player.radius, 3);
        const absorberMass = Math.pow(updateRequest.absorberRadius, 3);
        
        // Check if absorber is at least 10% larger in mass
        if (absorberMass / localMass >= 1.1) {
          // We're being absorbed, let's update our presence to reflect that
          this.room.updatePresence({
            isAbsorbed: true,
            absorbedBy: fromClientId
          });
        }
      }
    });

    // Set up message handler for events (sound effects, etc.)
    this.room.onmessage = (event) => {
      if (!event || !event.data) return;
      
      const data = event.data;
      switch (data.type) {
        case "connected":
          console.log(`Client ${data.clientId} connected`);
          break;
        case "disconnected":
          console.log(`Client ${data.clientId} disconnected`);
          this.handleDisconnect(data.clientId);
          break;
        case "object-picked-up":
          // When a peer picks up an object, remove that object from our city
          if (data.bodyId && this.game.cityGenerator) {
            this.game.cityGenerator.removeObjectByBodyId(data.bodyId);
          }
          break;
        default:
          // Handle other event types if needed
          break;
      }
    };

    // Initial presence update
    this.updatePlayerPresence();
  }

  updateRemotePlayer(clientId, playerData) {
    // Skip if player data doesn't have the necessary position info
    if (!playerData.position || !playerData.quaternion) return;
    
    // Skip if the player is absorbed (no longer visible)
    if (playerData.isAbsorbed) {
      // If we're the one who absorbed this player, increase our size
      if (playerData.absorbedBy === this.room.clientId && this.player) {
        // Add size to our player based on the absorbed player's radius
        this.player.absorbPlayer(playerData.radius || 1);
      }
      this.handleDisconnect(clientId);
      return;
    }

    // If we haven't seen this peer yet, create a detailed ball representation
    if (!this.peerPlayers[clientId]) {
      const group = new THREE.Group();
      // Create main ball mesh reflecting radius
      const radius = playerData.radius || 1;
      const geometry = new THREE.SphereGeometry(radius, 32, 32);
      const material = new THREE.MeshPhongMaterial({ color: 0x00ff00 });
      const ballMesh = new THREE.Mesh(geometry, material);
      ballMesh.castShadow = true;
      group.add(ballMesh);
      group.userData.mainBallMesh = ballMesh;
      
      // Add attachments if they exist
      if (playerData.attachedData) {
        this.updateAttachments(group, playerData.attachedData, radius);
      }
      
      this.scene.add(group);
      this.peerPlayers[clientId] = group;
      
      // Create a Cannon physics body for this remote player
      const mass = radius * 2; // Simplified mass estimation
      const shape = new CANNON.Sphere(radius);
      const body = new CANNON.Body({
        mass: mass,
        shape: shape,
        position: new CANNON.Vec3(
          playerData.position.x, 
          playerData.position.y, 
          playerData.position.z
        )
      });
      
      body.quaternion.set(
        playerData.quaternion.x, 
        playerData.quaternion.y, 
        playerData.quaternion.z, 
        playerData.quaternion.w
      );
      
      this.world.addBody(body);
      this.peerBodies[clientId] = body;
    } else {
      // Update existing peer ball (both 3D group and physics body)
      const group = this.peerPlayers[clientId];
      const body = this.peerBodies[clientId];
      
      if (!group || !body) return;
      
      const targetPos = new CANNON.Vec3(
        playerData.position.x, 
        playerData.position.y, 
        playerData.position.z
      );
      
      // Compute velocity update based on difference
      const velocityFactor = 10; // 1/0.1 sec approximation
      const deltaPos = targetPos.vsub(body.position);
      body.velocity.set(
        deltaPos.x * velocityFactor,
        deltaPos.y * velocityFactor,
        deltaPos.z * velocityFactor
      );
      
      // Update rotation
      body.quaternion.set(
        playerData.quaternion.x, 
        playerData.quaternion.y, 
        playerData.quaternion.z, 
        playerData.quaternion.w
      );
      
      // Update radius if needed
      if (body.shapes[0] && body.shapes[0].radius !== playerData.radius) {
        // Update physics shape
        body.shapes = [];
        const newShape = new CANNON.Sphere(playerData.radius);
        body.addShape(newShape);
        body.mass = playerData.radius * 2;
        body.updateMassProperties();
        
        // Update visual mesh
        if (group.userData && group.userData.mainBallMesh) {
          const mainBallMesh = group.userData.mainBallMesh;
          if (mainBallMesh.geometry) {
            mainBallMesh.geometry.dispose();
            mainBallMesh.geometry = new THREE.SphereGeometry(playerData.radius, 32, 32);
          }
        }
      }
      
      // Update attachments
      this.updateAttachments(group, playerData.attachedData, playerData.radius);
    }
  }

  updateAttachments(group, attachedData, radius) {
    // Remove existing attachments except the main ball mesh
    while (group.children.length > 1) {
      const child = group.children[1];
      group.remove(child);
      if (child.geometry) child.geometry.dispose();
      if (child.material) child.material.dispose();
    }
    
    // Add new attachments
    if (attachedData && Array.isArray(attachedData)) {
      attachedData.forEach(attachment => {
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
  }

  handleDisconnect(clientId) {
    // Remove disconnected player's mesh and physics body
    if (this.peerPlayers[clientId]) {
      this.scene.remove(this.peerPlayers[clientId]);
      delete this.peerPlayers[clientId];
    }
    
    if (this.peerBodies[clientId]) {
      this.world.removeBody(this.peerBodies[clientId]);
      delete this.peerBodies[clientId];
    }
  }

  updatePeers() {
    // Update remote peer 3D groups from their physics bodies
    for (const clientId in this.peerBodies) {
      const body = this.peerBodies[clientId];
      const group = this.peerPlayers[clientId];
      if (group && body && body.position && body.quaternion) {
        group.position.copy(body.position);
        group.quaternion.copy(body.quaternion);
      }
    }
  }

  updatePlayerPresence() {
    if (!this.player || !this.player.mesh || !this.player.body) return;
    
    const attachedData = this.player.attachedMeshes.map(att => {
      if (!att || !att.direction || !att.mesh) return null;
      return {
        direction: { 
          x: att.direction.x, 
          y: att.direction.y, 
          z: att.direction.z 
        },
        itemName: att.mesh.userData && att.mesh.userData.itemName || ""
      };
    }).filter(data => data !== null);
    
    this.room.updatePresence({
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
      isDemo: this.game.gameState === "TITLE",
      isAbsorbed: false
    });
  }

  sendPlayerState() {
    // Update player presence regularly
    if (performance.now() - this.lastSentPosition > 100) {
      this.updatePlayerPresence();
      this.lastSentPosition = performance.now();
    }
  }

  notifyObjectPickup(objectId) {
    // Update room state to reflect collected object
    this.room.updateRoomState({
      collectedObjects: {
        [objectId]: {
          collectedBy: this.room.clientId,
          timestamp: Date.now()
        }
      }
    });
    
    // Also send an event for immediate notification
    this.room.send({
      type: "object-picked-up",
      bodyId: objectId
    });
  }

  requestAbsorbPlayer(clientId) {
    if (!this.player) return;
    
    this.room.requestPresenceUpdate(clientId, {
      type: 'absorb',
      absorberRadius: this.player.radius
    });
  }
}
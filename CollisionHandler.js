export class CollisionHandler {
  constructor(game) {
    this.game = game;
    this.player = game.player;
    this.cityGenerator = game.cityGenerator;
    this.pickupPreview = game.pickupPreview;
    this.room = game.multiplayerManager.room;
    this.scene = game.scene;
    this.world = game.world;
    this.peerPlayers = game.multiplayerManager.peerPlayers;
    this.peerBodies = game.multiplayerManager.peerBodies;
    
    this.setupCollisionHandling();
  }

  setupCollisionHandling() {
    this.player.body.addEventListener('collide', (event) => {
      // Guard against undefined event or body
      if (!event || !event.body) return;
      
      const otherBody = event.body;

      if (!otherBody || otherBody.mass === 0) return;

      // Only check ground objects for collision with the player.
      const groundObjects = [];
      this.cityGenerator.objects.forEach(chunkData => {
        if (chunkData && chunkData.ground) {
          groundObjects.push(...chunkData.ground);
        }
      });
      
      const object = groundObjects.find((obj) => obj && obj.body === otherBody);

      if (object && object.body && object.body.shapes && object.body.shapes[0]) {
        const objectShape = object.body.shapes[0];
        
        // Improved size calculation to handle Cylinder and other shapes
        let objectSize = 0;
        if (objectShape.radius !== undefined) {
          objectSize = objectShape.radius;
        } else if (objectShape.halfExtents) {
          objectSize = Math.max(
            objectShape.halfExtents.x,
            objectShape.halfExtents.y,
            objectShape.halfExtents.z
          );
        } else if (objectShape instanceof CANNON.Cylinder) {
          // Handle Cylinder shape (Human/Citizen)
          // Use the max dimension as size
          const r = Math.max(objectShape.radiusTop || 0, objectShape.radiusBottom || 0);
          const h = objectShape.height || 0;
          objectSize = Math.max(r, h / 2);
        }

        if (objectSize < this.player.radius) {
          // Update the pickup preview UI before absorbing the object
          const previewClone = object.mesh.clone();
          const itemName = object.mesh.userData && object.mesh.userData.itemName || "Collectible";
          this.pickupPreview.update(previewClone, itemName);
          
          // Play silly scream for citizens
          if (itemName === "Citizen") {
            const scream = new Audio('scream.mp3');
            scream.volume = 0.3;
            scream.play().catch(e => console.log(e));
          }

          this.player.absorbObject(object);

          // Remove object from the chunk's ground objects array
          this.cityGenerator.objects.forEach(chunkData => {
            if (chunkData && chunkData.ground) {
              const index = chunkData.ground.findIndex((obj) => obj && obj.body === otherBody);
              if (index !== -1) {
                chunkData.ground.splice(index, 1);
              }
            }
          });

          document.getElementById('size-value').textContent =
            this.player.getSize().toFixed(1);
          document.getElementById('score-value').textContent =
            this.player.getCollectedCount();

          // Notify the multiplayer manager about the object pickup
          this.game.multiplayerManager.notifyObjectPickup(object.body.id);
        }
      }
    });
  }

  checkPlayerCollisions() {
    if (!this.player || !this.player.mesh) return;
    
    const localPos = this.player.mesh.position;
    const localRadius = this.player.radius;
    for (const clientId in this.peerPlayers) {
      const group = this.peerPlayers[clientId];
      if (!group || !group.userData || !group.userData.mainBallMesh) continue;
      
      // Get remote player's radius from its main ball mesh
      const peerRadius = group.userData.mainBallMesh.geometry.parameters.radius;
      const distance = localPos.distanceTo(group.position);
      if (distance < localRadius + peerRadius) {
        // If the local player is at least 5m larger, absorb the remote player.
        if (localRadius >= peerRadius + 5) {
          // Request to absorb the remote player
          this.game.multiplayerManager.requestAbsorbPlayer(clientId);
        }
        // Otherwise, if the remote player is at least 5m larger, mark local player as stuck.
        else if (peerRadius >= localRadius + 5) {
          if (!this.player.isStuck) {
            this.player.isStuck = true;
            this.player.stuckTo = clientId;
          }
        }
      } else {
        // If previously stuck to this peer and no longer colliding, clear stuck state.
        if (this.player.isStuck && this.player.stuckTo === clientId) {
          this.player.isStuck = false;
          this.player.stuckTo = null;
        }
      }
    }
  }
}
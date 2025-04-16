export class CollisionHandler {
  constructor(game) {
    this.game = game;
    this.player = game.player;
    this.cityGenerator = game.cityGenerator;
    this.pickupPreview = game.pickupPreview;
    this.room = game.room;
    this.scene = game.scene;
    this.world = game.world;
    this.peerPlayers = game.peerPlayers;
    this.peerBodies = game.peerBodies;
    
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
        const objectSize = 
          (objectShape.radius) || 
          (objectShape.halfExtents && Math.max(
            objectShape.halfExtents.x,
            objectShape.halfExtents.y,
            objectShape.halfExtents.z
          )) || 0;

        if (objectSize < this.player.radius) {
          // Update the pickup preview UI before absorbing the object
          const previewClone = object.mesh.clone();
          const itemName = object.mesh.userData && object.mesh.userData.itemName || "Collectible";
          this.pickupPreview.update(previewClone, itemName);

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

          // Persist the pickup to the database so that it appears in the live multiplayer lobby
          (async () => {
            try {
              await this.room.collection('pickup').create({
                objectName: itemName,
                playerId: this.room.party.client.id,
                size: this.player.getSize()
              });
            } catch (error) {
              console.error('Error saving pickup record:', error);
            }
          })();

          // Notify all peers to remove this object from their scenes
          this.room.send({
            type: "object-picked-up",
            bodyId: object.body.id
          });
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
          this.absorbPeer(clientId, peerRadius);
        }
        // Otherwise, if the remote player is at least 5m larger, mark local player as stuck.
        else if (peerRadius >= localRadius + 5) {
          if (!this.player.isStuck) {
            this.player.isStuck = true;
            this.player.stuckTo = clientId;
            // Optionally, you could provide a visual indicator here.
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

  absorbPeer(clientId, peerRadius) {
    // Remove peer's mesh from scene and from peerPlayers and physics world.
    const peerGroup = this.peerPlayers[clientId];
    if (peerGroup) {
      this.scene.remove(peerGroup);
      delete this.peerPlayers[clientId];
    }
    if (this.peerBodies[clientId]) {
      this.world.removeBody(this.peerBodies[clientId]);
      delete this.peerBodies[clientId];
    }
    // Compute volumes for both balls
    const localVolume = (4 / 3) * Math.PI * Math.pow(this.player.radius, 3);
    const peerVolume = (4 / 3) * Math.PI * Math.pow(peerRadius, 3);
    const newVolume = localVolume + peerVolume;
    const newRadius = Math.cbrt((3 * newVolume) / (4 * Math.PI));

    // Update player's radius
    const oldRadius = this.player.radius;
    this.player.radius = newRadius;
    // Update the main collision shape
    this.player.body.shapes[0].radius = newRadius;
    // Update mass proportionally (approximation)
    const newMass = this.player.body.mass * (newVolume / localVolume);
    this.player.body.mass = newMass;
    this.player.body.updateMassProperties();

    // Update the player's mesh geometry
    const newGeometry = new THREE.SphereGeometry(newRadius, 32, 32);
    this.player.mesh.geometry.dispose();
    this.player.mesh.geometry = newGeometry;

    // Update attached meshes positions
    this.player.attachedMeshes.forEach(attached => {
      const newPos = attached.direction.clone().multiplyScalar(newRadius);
      attached.mesh.position.copy(newPos);
    });

    // Update UI for size
    document.getElementById('size-value').textContent = newRadius.toFixed(1);
  }
}
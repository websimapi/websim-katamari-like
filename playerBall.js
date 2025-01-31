export class PlayerBall {
  constructor(world) {
    this.world = world;
    this.collectedObjects = [];
    
    this.body = Matter.Bodies.circle(0, 0, 10, {
      render: {
        fillStyle: '#FF69B4'
      }
    });
    
    Matter.World.add(world, this.body);
  }

  applyForce(force) {
    Matter.Body.applyForce(this.body, this.body.position, force);
  }

  absorbObject(object) {
    Matter.World.remove(this.world, object);
    this.collectedObjects.push(object);
    
    // Increase ball size based on collected object
    const currentRadius = this.body.circleRadius;
    const newRadius = Math.sqrt(
      Math.pow(currentRadius, 2) + 
      Math.pow(object.circleRadius || Math.sqrt(object.area / Math.PI), 2)
    );
    
    Matter.Body.scale(this.body, newRadius / currentRadius, newRadius / currentRadius);
  }

  getSize() {
    return this.body.circleRadius * 2 / 10; // Convert to meters
  }

  getCollectedCount() {
    return this.collectedObjects.length;
  }
}
importScripts('https://cdn.jsdelivr.net/npm/cannon@0.6.2/build/cannon.min.js');

let world;
let lastTime = 0;

// Initialize physics world
function init() {
  world = new CANNON.World();
  world.gravity.set(0, -20, 0);
  world.broadphase = new CANNON.NaiveBroadphase();
  world.solver.iterations = 10;
}

// Handle physics updates
onmessage = function(e) {
  if (!world) init();
  
  const { playerPos, deltaTime } = e.data;
  
  // Step physics simulation
  world.step(1/60, deltaTime, 3);
  
  // Send updated physics state back to main thread
  postMessage({
    playerPos: world.bodies[0].position,
    playerVel: world.bodies[0].velocity
  });
};
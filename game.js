import { CityGenerator } from './cityGenerator.js';
import { PlayerBall } from './playerBall.js';

const Engine = Matter.Engine,
      Render = Matter.Render,
      World = Matter.World,
      Bodies = Matter.Bodies,
      Body = Matter.Body,
      Events = Matter.Events;

class Game {
  constructor() {
    this.engine = Engine.create();
    this.engine.world.gravity.y = 0;
    
    this.canvas = document.getElementById('gameCanvas');
    this.render = Render.create({
      canvas: this.canvas,
      engine: this.engine,
      options: {
        width: window.innerWidth,
        height: window.innerHeight,
        wireframes: false,
        background: '#87CEEB'
      }
    });

    this.cityGenerator = new CityGenerator(this.engine.world);
    this.player = new PlayerBall(this.engine.world);
    
    this.setupControls();
    this.setupCollisions();
    this.start();
  }

  setupControls() {
    this.joystick = nipplejs.create({
      zone: document.getElementById('joystick-area'),
      mode: 'static',
      position: { left: '60px', bottom: '60px' },
      color: 'white'
    });

    this.joystick.on('move', (evt, data) => {
      const force = {
        x: data.vector.x * 0.001,
        y: data.vector.y * 0.001
      };
      this.player.applyForce(force);
    });

    window.addEventListener('keydown', (e) => {
      const force = { x: 0, y: 0 };
      const speed = 0.001;
      
      switch(e.key) {
        case 'ArrowUp': force.y = -speed; break;
        case 'ArrowDown': force.y = speed; break;
        case 'ArrowLeft': force.x = -speed; break;
        case 'ArrowRight': force.x = speed; break;
      }
      
      this.player.applyForce(force);
    });
  }

  setupCollisions() {
    Events.on(this.engine, 'collisionStart', (event) => {
      event.pairs.forEach((pair) => {
        const { bodyA, bodyB } = pair;
        const playerBody = this.player.body;
        
        if (bodyA === playerBody || bodyB === playerBody) {
          const otherBody = bodyA === playerBody ? bodyB : bodyA;
          
          if (otherBody.mass < playerBody.mass && !otherBody.isStatic) {
            this.player.absorbObject(otherBody);
            document.getElementById('size-value').textContent = 
              (this.player.getSize()).toFixed(1);
            document.getElementById('score-value').textContent = 
              this.player.getCollectedCount();
          }
        }
      });
    });
  }

  start() {
    Engine.run(this.engine);
    Render.run(this.render);
    
    this.gameLoop();
  }

  gameLoop() {
    this.cityGenerator.update(this.player.body.position);
    requestAnimationFrame(() => this.gameLoop());
  }
}

new Game();
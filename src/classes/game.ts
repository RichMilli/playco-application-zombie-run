import * as PIXI from 'pixi.js';
import {Player} from './player';
import {Input} from './input';
import { MapLoader } from './map-loader';

export class Game {

    private app: PIXI.Application = null!;
    private input: Input = null!;
    private player: Player = null!;

    private zombies: Player[] = [];

    private readonly width = 800;
    private readonly height = 600;
    private readonly scale = 2;
    

    constructor() {
        PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

        // App
        const app = new PIXI.Application({
            width: this.width,
            height: this.height,
            backgroundColor: 0xff00ff,
            resolution: window.devicePixelRatio || 1
        });

        app.stage.addChild(new PIXI.Container());
        app.stage.scale.set(this.scale);

        this.app = app;

        // Input
        const input = new Input();
        this.input = input;        
    }

    getApp() {
        return this.app;
    }

    start() {
        this.loadAssets();
        this.input.start();

        this.watchGameEvents();

        if (this.app) {
            this.app.ticker.add((delta: number) => {
                this.gameLoop(delta);
            });
        }
    }

    private loadAssets() {
        if (this.app) {
            // Load first girl character sprite
            this.app.loader
                .add('girl1', '/assets/girl4.json')
                .add('girl2', '/assets/girl2.json')
                .add('tiles-data', '/assets/hospital-tiles.json')
                .add('tiles-image', '/assets/hospital-tiles.png')
                .add('map-data', '/assets/maptest.json')
                .load((e: any, r: any) => {
                    // Player
                    if (r && r['girl1']) {
                        const res = r['girl1'];
                        const frameNames = res.data && res.data.frames ? Object.keys(res.data.frames) : [];

                        const p = new Player(frameNames);
                        this.player = p;
            
                        this.app.stage.addChild(p.getSprite());
                    }

                    // Zombies
                    if (r && r['girl2']) {
                        const res = r['girl2'];
                        const frameNames = res.data && res.data.frames ? Object.keys(res.data.frames) : [];

                        for (let i = 0; i < 10; i++) {
                            const x = this.app.stage.width * Math.random();
                            const y = this.app.stage.height * Math.random();

                            const z = new Player(frameNames);
                            z.setPosition(x, y);
                            z.setZombie(true);
                            this.app.stage.addChild(z.getSprite());

                            this.zombies.push(z);
                        }
                    }

                    if (r && r['tiles-data'] && r['tiles-image'] && r['map-data']) {
                        const tileData = r['tiles-data'].data;
                        const tileTextures = r['tiles-image'].texture;
                        const mapData = r['map-data'].data;

                        const mapLoader = new MapLoader(tileData, tileTextures, mapData);
                        const sprites = mapLoader.getMapSprites();
                        if (sprites) {
                            sprites.forEach(s => this.app.stage.addChild(s));
                        }
                    }
                });
        }
    }

    private watchGameEvents(): void {
        // Toggle the zombie mode when the user presses space
        this.input.onKeyPress(32)
            .subscribe(() => {
                const z = this.player.getZombie();
                const d = this.player.getIsDead();

                if (!z && !d) {
                    this.player.setZombie(true);
                } else if (z && !d) {
                    this.player.setZombie(false);
                    this.player.setIsDead(true);
                } else if (!z && d) {
                    this.player.setIsDead(false);
                }
            })
    }

    private gameLoop(delta: number): void {
        if (this.player && this.input) {
            const player = this.player;
            player.setIsMovingForward(this.input.getKeyState(87) || false); // w
            player.setIsMovingBackward(this.input.getKeyState(83) || false); // d
            player.setIsMovingLeft(this.input.getKeyState(65) || false); // a
            player.setIsMovingRight(this.input.getKeyState(68) || false); // d
            player.update(delta);
            
            const pos = player.getPosition();

            // TO DO - Boids to scatter
            for (const zombie of this.zombies) {
                zombie.followPosition(pos[0], pos[1]);
                zombie.update(delta);
            }
            
        }

        this.updateZSorting();
        this.checkCollisions();
    }

    private updateZSorting(): void {
        // TO DO - Add rules for different layers

        // Update order on the stage based on current y position (based on anchor)
        // If they are dead they stay on the ground (need more configuration here)

        // Really bad sorting - will fix this

        this.app.stage.children.sort((a, b) => {

            if (a.name && b.name && a.name === b.name && a.name === 'player') {
                if(a.y < b.y) {
                    return -1;
                } else if (a.y > b.y) {
                    return 1;
                } else {
                    return 0;
                }
            } else if (a.name && b.name && a.name === 'player' && b.name === 'map') {
                return 1;
            } else if (a.name && b.name && a.name === 'map' && b.name === 'player') {
                return -1;
            } else if (a.name && b.name && a.name === 'map' && b.name === 'map') {
                if(a.y < b.y) {
                    return -1;
                } else if (a.y > b.y) {
                    return 1;
                } else {
                    return 0;
                }
            }

            return -1;
            
        });
    }

    private doIntersect(a: PIXI.Rectangle, b: PIXI.Rectangle): boolean {
        return a.x + a.width > b.x &&
            a.x < b.x + b.width &&
            a.y + a.height > b.y &&
            a.y < b.y + b.height;
    }
    
    private checkCollisions(): void {
        // Check if player and zombies collide
        if (this.player && this.zombies && this.zombies.length > 0) {
            const player = this.player;
            const playerBounds = player.getBounds();
    
            const zombies = this.zombies;
    
            for (const zombie of zombies) {
                const zombBound = zombie.getBounds();
    
                const interesct = this.doIntersect(playerBounds, zombBound);

                if (interesct) {
                    // console.log('intersects', interesct);
                }
                
            }

            // Restrict player to screen
            const playerPos = player.getPosition();
            const originalPos = [playerPos[0], playerPos[1]];

            const xBuffer = playerBounds.width;
            const yBuffer = playerBounds.height;

            const minX = xBuffer * 0.5 / this.scale;
            const maxX = (this.width - xBuffer * 0.5) / this.scale;

            const minY = yBuffer * 0.5 / this.scale;
            const maxY = (this.height - yBuffer * 0.5) / this.scale;

            if (playerPos[0] < minX) {
                playerPos[0] = minX;
            } else if (playerPos[0] > maxX) {
                playerPos[0] = maxX;
            }

            if (playerPos[1] < minY) {
                playerPos[1] = minY;
            } 
            else if (playerPos[1] > maxY) {
                playerPos[1] = maxY;
            }

            if (originalPos[0] !== playerPos[0] || originalPos[1] !== playerPos[1]) {
                player.setPosition(playerPos[0], playerPos[1]);
            }
            
        }
    }
    
}
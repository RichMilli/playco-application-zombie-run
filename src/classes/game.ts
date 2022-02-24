import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';

import {Player} from './player';
import {Input} from './input';
import { MapLoader } from './map-loader';

import {Bump} from './../external/bump';
import e from 'express';

export class Game {

    private app: PIXI.Application = null!;
    private viewport: Viewport = null!;
    private bump: Bump = null!;

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

        this.app = app;

        // Viewport
        const viewport = new Viewport({
            screenWidth: this.width,
            screenHeight:  this.height,
            worldWidth: this.width,
            worldHeight: this.height,
            ticker: app.ticker,
            interaction: app.renderer.plugins.interaction
        });

        this.viewport = viewport;
        
        app.stage.addChild(viewport);
        viewport.scale.set(this.scale);

        // Collision detection
        const bump = new Bump(PIXI);
        this.bump = bump;

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
            
                        const sprite = p.getSprite();

                        this.viewport.addChild(sprite);
                        //this.viewport.follow(sprite);
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
                            this.viewport.addChild(z.getSprite());

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
                            sprites.forEach(s => this.viewport.addChild(s));
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

        if (this.viewport && this.player) {
            const pos = this.player.getPosition();
            this.viewport.moveCenter(pos[0], pos[1]);
        }
    }
    
    private ySorting(a: number, b: number): number {
        if (a < b) {
            return -1;
        } else if (a > b) {
            return 1;
        } else {
            return 0;
        }
    }

    private updateZSorting(): void {
        // Map and "player" based sorting

        this.viewport.children.sort((a, b) => {

            if (a.name && b.name) {
                if ((a.name.startsWith('map_') || a.name === 'player') && b.name.startsWith('map_')) {
                    if (b.name.includes('Above')) {
                        return -1;
                    } else if (b.name.includes('Middle')) {
                        return this.ySorting(a.y, b.y);
                    } else if (b.name.includes('Below')) {
                        return 1;
                    }
                } else if (a.name.startsWith('map_') && b.name === 'player') {
                    if (a.name.includes('Above')) {
                        return 1;
                    } else if (a.name.includes('Middle')) {
                        return this.ySorting(a.y, b.y);
                    } else if (a.name.includes('Below')) {
                        return -1;
                    }
                } else if (a.name === 'player' && b.name === 'player') {
                    return this.ySorting(a.y, b.y);
                }
            }

            return -1;
        });
    }

    private checkCollisions(): void {
        this.checkPlayerZombieCollisions();
        this.checkPlayerMapCollisions();

        // Probably not necessary once pathfinding is set up
        // this.checkZombieMapCollisions();
    }

    private checkPlayerZombieCollisions(): void {
        if (this.player && this.zombies && this.zombies.length > 0) {
            const player = this.player;

            const zombies = this.zombies.map(z => z.getSprite());

            (this.bump as any).hit(player.getSprite(), zombies, false, false, false, (collision: any, sprite: any) => {
                // console.log('zombie collision', collision); // gives direction
            })
        }
    }

    private checkPlayerMapCollisions(): void {
        if (this.player && this.viewport && this.viewport.children) {
            const player = this.player;

            // Get map elements that have collisions
            const mapCollisionTiles = this.viewport.children.filter(c => c.name.toLowerCase().endsWith('_collide'));

            (this.bump as any).hit(player.getSprite(), mapCollisionTiles, true, false, false, (collision: any, sprite: any) => {
                // console.log('stage collision', collision); // gives direction
            });
        }
    }

    private checkZombieMapCollisions(): void {
        if (this.zombies && this.zombies.length > 0 && this.viewport && this.viewport.children) {
            const zombies = this.zombies.map(z => z.getSprite());

            // Get map elements that have collisions
            const mapCollisionTiles = this.viewport.children.filter(c => c.name.toLowerCase().endsWith('_collide'));

            for (const z of zombies) {
                (this.bump as any).hit(z, mapCollisionTiles, true, false, false, (collision: any, sprite: any) => {
                    // console.log('stage collision', collision); // gives direction
                });
            }            
        }
    }
    
}
import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';

import {Player} from './player';
import {Input} from './input';
import { MapLoader } from './map-loader';

import {Bump} from './../external/bump';
import {js as EasyStar} from 'easystarjs';
import { Item } from './item';
import e from 'express';
import { ItemNames } from '../enums/item-names';

export class Game {

    private app: PIXI.Application = null!;
    private viewport: Viewport = null!;
    private bump: Bump = null!;
    private easyStar: EasyStar = null!;

    private map: MapLoader = null!;

    private input: Input = null!;
    private player: Player = null!;

    private zombies: Player[] = [];
    private items: Item[] = [];

    private readonly width = 800;
    private readonly height = 600;
    private readonly scale = 2;

    private assetsLoaded: boolean = false;

    private playerHealth: number = 100;
    private playerScore: number = 0;

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

        // Path finding
        const easyStar = new EasyStar();
        this.easyStar = easyStar;

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

    private loadMap(tileData: any, tileTextures: any, mapData: any): void {
        if (!tileData || !tileTextures || !mapData) return;

        const mapLoader = new MapLoader(tileData, tileTextures, mapData);
        const sprites = mapLoader.getMapSprites();
        if (sprites) {
            sprites.forEach(s => this.viewport.addChild(s));
        }

        const collisionGrid = mapLoader.getCollisionGrid();
        const grid = collisionGrid.map(r => r.map(c => c.val));

        this.map = mapLoader;
        console.log('setting grid', grid);

        this.easyStar.setGrid(grid);
        this.easyStar.setAcceptableTiles([0]);
    }

    private setupPlayer(playerFrames: any[]): void {
        const p = new Player(playerFrames);
        this.player = p;
        p.setIsHit(3);

        const sprite = p.getSprite();

        this.viewport.addChild(sprite);
        this.viewport.follow(sprite);
    }

    private loadZombies(zombieFrames: any[]): void {
        for (let i = 0; i < 10; i++) {
            const zombiePos = this.getRandomWorldPosition();

            const zombie = new Player(zombieFrames);
            zombie.setPosition(zombiePos.x, zombiePos.y);
            zombie.setZombie(true);
            this.viewport.addChild(zombie.getSprite());

            this.zombies.push(zombie);
        }
    }

    private spawnNewItem(): void {
        if (this.app && this.app.loader && this.app.loader.resources) {

            const itemType = ItemNames.ITEM_SHINY;
            const itemPos = this.getRandomWorldPosition();
            const frames = Object.keys(this.app.loader.resources[itemType].data.frames);
            const item = new Item(frames, itemPos.x, itemPos.y, itemType);

            // console.log('item', item);
            this.viewport.addChild(item.getSprite());

            // Remove item when it expires
            item.onExpire().subscribe(() => {
                const itemIndex = this.items.findIndex(i => i === item);
                if (itemIndex > -1) {
                    this.removeItem(itemIndex, false);
                }
            });

            this.items.push(item);
        }
    }

    private spawnItems(): void {
        if (this.assetsLoaded) {
            const r = Math.round(Math.random() * 100000) / 100000;
    
            if (r > 0.10000 && r < 0.10500) {
                this.spawnNewItem();
            }
        }
    }

    private updateItemLife(delta: number): void {
        if (this.items && this.items.length) {
            this.items.forEach(i => i.update(delta));
        }
    }

    private removeItem(itemIndex: number, collected?: boolean): void {
        if (this.items && this.items[itemIndex]) {
            // Remove item from viewport
            this.viewport.removeChild(this.items[itemIndex].getSprite());
            

            // TO DO - Collected action
            if (collected) {
                // do here
                const type = this.items[itemIndex].getItemType();

                switch(type)  {
                    case ItemNames.ITEM_BRAIN:
                        // become zombie temporarily
                        break;
                    case ItemNames.ITEM_CHIP:
                        // increase recovery time
                        break;
                    case ItemNames.ITEM_HEALTH_PACK:
                        // increase health
                        break;
                    case ItemNames.ITEM_KEY:
                        // add key (to get through doors)
                        break;
                    case ItemNames.ITEM_KEYCARD:
                        // add keycard (to get through doors)
                        break;
                    case ItemNames.ITEM_SPROUT:
                        // add score (bonus)
                        this.playerScore += 500;
                        console.log('player score', this.playerScore);
                        break;
                    case ItemNames.ITEM_SHINY:
                        // add score
                        this.playerScore += 50;
                        console.log('player score', this.playerScore);
                        break;
                }
            }

            // Remove item from array
            this.items.splice(itemIndex, 1);
        }
    }

    private loadAssets(): void {
        if (this.app) {
            // Load first girl character sprite
            this.app.loader

                // Zombie sprites
                .add('girl1', '/assets/girl4.json')
                .add('girl2', '/assets/girl2.json')

                // Items
                .add(ItemNames.ITEM_BRAIN, '/assets/item-brain.json')
                .add(ItemNames.ITEM_CHIP, '/assets/item-chip.json')
                .add(ItemNames.ITEM_HEALTH_PACK, '/assets/item-health-pack.json')
                .add(ItemNames.ITEM_KEY, '/assets/item-key.json')
                .add(ItemNames.ITEM_KEYCARD, '/assets/item-keycard.json')
                .add(ItemNames.ITEM_SPROUT, '/assets/item-sprout.json')
                .add(ItemNames.ITEM_SHINY, '/assets/item-shiny.json')

                // Map Stuff
                .add('tiles-data', '/assets/hospital-tiles.json')
                .add('tiles-image', '/assets/hospital-tiles.png')
                .add('map-data', '/assets/maptest.json')
                .load((e: PIXI.Loader, r: {[key: string]: PIXI.LoaderResource} ) => {
                    this.assetsLoaded = true;

                    // Load map
                    if (r && r['tiles-data'] && r['tiles-image'] && r['map-data']) {
                        this.loadMap(r['tiles-data'].data, r['tiles-image'].texture, r['map-data'].data);
                    }

                    // Player
                    if (r && r['girl1'] && r['girl1'].data && r['girl1'].data.frames) {
                        this.setupPlayer(Object.keys(r['girl1'].data.frames));
                        //
                    }

                    // Zombies
                    if (r && r['girl2'] && r['girl2'].data && r['girl2'].data.frames) {
                        this.loadZombies(Object.keys(r['girl2'].data.frames));
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

    private getRandomGridPosition(): {x: number, y: number} {
        if (this.map) {
            return this.map.getRandomGridGroundPosition();    
        }

        return null!;
    }

    private getRandomWorldPosition(): {x: number, y: number} {
        const pos = this.getRandomGridPosition();
        const collisionGrid = this.map ? this.map.getCollisionGrid() : null;
        if (pos && collisionGrid) {
            const gridItem = collisionGrid[pos.y][pos.x];

            return {
                x: gridItem.x,
                y: gridItem.y
            };
        }

        return null!;
    }    

    private gameLoop(delta: number): void {
        // Update player
        this.updatePlayer(delta);

        // Update zombie position
        this.updateZombies(delta);

        this.updateZSorting();
        this.checkCollisions();

        // Update viewport
        this.updateViewport();

        // Spawn items
        this.spawnItems();
        this.updateItemLife(delta);
    }

    private updatePlayer(delta: number): void {
        if (!this.player || !this.input) return;

        const player = this.player;
        player.setIsMovingForward(this.input.getKeyState(87) || false); // w
        player.setIsMovingBackward(this.input.getKeyState(83) || false); // d
        player.setIsMovingLeft(this.input.getKeyState(65) || false); // a
        player.setIsMovingRight(this.input.getKeyState(68) || false); // d
        player.update(delta);
    }

    private updateZombies(delta: number): void {
        // Give zombie new path if it does not have one
        for (const zombie of this.zombies) {
            if (!zombie.getCurrentPath() && !zombie.getFindingPath()) {
                
                const pos = zombie.getPosition();

                if (this.map) {
                    const gridPos = this.map.getGridReferencePosition(pos[0], pos[1]);
                    if (gridPos) {
                        zombie.setFindingPath(true);
                        const newPos = this.getRandomGridPosition();
                        this.easyStar.findPath(gridPos.x, gridPos.y, newPos.x, newPos.y, (path) => {
                            if (path) {
                                const adjustedPath = this.map.getMapPositionsFromPath(path);
                                zombie.setNewPath(adjustedPath);
                            }

                            zombie.setFindingPath(false);
                        });
                    }
                }
            }

            zombie.onPathTick();
            zombie.update(delta);
        }

        // Update easy star on tick
        this.easyStar.calculate(); // working!
    }

    private updateViewport(): void {
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

        const midLayers = ['player', 'item'];

        this.viewport.children.sort((a, b) => {

            if (a.name && b.name) {
                if ((a.name.startsWith('map_') || midLayers.includes(a.name)) && b.name.startsWith('map_')) {
                    if (b.name.includes('Above')) {
                        return -1;
                    } else if (b.name.includes('Middle')) {
                        return this.ySorting(a.y, b.y);
                    } else if (b.name.includes('Below')) {
                        return 1;
                    }
                } else if (a.name.startsWith('map_') && midLayers.includes(b.name)) {
                    if (a.name.includes('Above')) {
                        return 1;
                    } else if (a.name.includes('Middle')) {
                        return this.ySorting(a.y, b.y);
                    } else if (a.name.includes('Below')) {
                        return -1;
                    }
                } else if (midLayers.includes(a.name) && midLayers.includes(b.name)) {
                    return this.ySorting(a.y, b.y);
                }
            }

            return -1;
        });
    }

    private checkCollisions(): void {
        this.checkPlayerZombieCollisions();
        this.checkPlayerMapCollisions();
        this.checkPlayerItemCollisions();
    }

    private checkPlayerZombieCollisions(): void {
        if (this.player && this.zombies && this.zombies.length > 0) {
            const player = this.player;
            const zombies = this.zombies.map(z => z.getSprite());

            (this.bump as any).hit(player.getSprite(), zombies, false, false, false, (collision: any, sprite: any) => {
                // console.log('zombie collision', collision); // gives direction
                this.hitPlayer(5);
            });
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
    
    private checkPlayerItemCollisions(): void {
        if (this.player && this.items && this.items.length > 0) {
            const player = this.player;
            const p = player.getBounds();

            let found = -1;
            for (let i = 0; i < this.items.length; i++) {
                const b = this.items[i].getSprite().getBounds();

                if (p.x + p.width - 16 > b.x &&
                    p.x < b.x + b.width - 16 &&
                    p.y + p.height - 32 > b.y &&
                    p.y < b.y + b.height - 32) {
                        found = i;
                        break;
                    }
            }

            if (found > -1) {
                this.removeItem(found, true);
            }
        }
    }

    private hitPlayer(hit: number): void {
        if (!this.player.getIsHit()) {
            this.player.setIsHit();
            
            this.playerHealth -= hit;

            console.log('player hit', this.playerHealth);

            if (this.playerHealth <= 0) {
                this.player.setIsDead(true);
            }
        }
    }
}
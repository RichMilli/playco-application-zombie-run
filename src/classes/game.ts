import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { sound } from '@pixi/sound';

import {Player} from './player';
import {Input} from './input';
import { MapLoader } from './map-loader';

import {Bump} from './../external/bump';
import {js as EasyStar} from 'easystarjs';
import { Item } from './item';
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
    private playerCloseZombies: number = 0;

    private playerHealthUI: PIXI.Graphics = null!;
    private playerScoreUI: PIXI.Text = null!;
    private playerZombieTime: number = null!;

    constructor() {
        PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;

        // App
        const app = new PIXI.Application({
            width: this.width,
            height: this.height,
            backgroundColor: 0x000000,
            resolution: 1
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

        this.easyStar.setGrid(grid);
        this.easyStar.setAcceptableTiles([0]);
    }

    private setupPlayer(playerFrames: any[]): void {
        const p = new Player(playerFrames);
        this.player = p;
        this.updatePlayerHealthUI();
        this.updatePlayerScoreUI();
        p.setIsHit(3);

        const sprite = p.getSprite();

        this.viewport.addChild(sprite);
        this.viewport.follow(sprite);
    }

    private loadZombies(zombieFrames: any[]): void {
        for (let i = 0; i < 10; i++) {
            const zombiePos = this.getRandomWorldPosition();

            if (zombiePos) {
                const zombie = new Player(zombieFrames);
                zombie.setPosition(zombiePos.x, zombiePos.y);
                zombie.setZombie(true);
                this.viewport.addChild(zombie.getSprite());
    
                this.zombies.push(zombie);
            }
        }
    }

    private updatePlayerHealthUI(): void {
        if (this.playerHealthUI) {
            this.app.stage.removeChild(this.playerHealthUI);
            this.playerHealthUI = null!;
        }

        const graphics = new PIXI.Graphics();
        graphics.beginFill(0x610505);
        graphics.drawRect(20, 20, 240, 20);
        graphics.endFill();

        const r = (this.playerHealth / 100)

        const color = this.player.getZombie() ? 0xAD235E : (
            r > 0.75 ? 0x980f11 : (
                r > 0.5 ? 0xac040c : (
                    r > 0.25 ? 0xe2111c : (
                        r > 0 ? 0xf40404 : 0x610505
                    )
                )
            )
        )

        graphics.beginFill(color);
        graphics.drawRect(20, 20, 240 * r, 20);
        graphics.endFill();

        this.app.stage.addChild(graphics);
        this.playerHealthUI = graphics;
    }

    private updatePlayerScoreUI(): void {
        if (this.playerScoreUI) {
            this.app.stage.removeChild(this.playerScoreUI);
            this.playerScoreUI = null!;
        }

        const textStyle = new PIXI.TextStyle({
            fontSize: 18,
            fontWeight: 'bold',
            fill: 0xFFFFFF,
            align: 'right'
        });
            
        const text = new PIXI.Text(this.playerScore.toString(), textStyle);
        text.anchor.set(1, 0.5);
        text.position.set(this.width - 20, 20);

        this.app.stage.addChild(text);
        this.playerScoreUI = text;
    }

    private spawnNewItem(itemType: ItemNames): void {
        if (this.app && this.app.loader && this.app.loader.resources) {
            const itemPos = this.getRandomWorldPosition();

            if (itemPos) {
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
    }

    private spawnItems(): void {
        if (this.assetsLoaded) {
            const r = Math.round(Math.random() * 100000) / 100000;
    
            if (r > 0.10000 && r < 0.10500) {
                this.spawnNewItem(ItemNames.ITEM_SHINY);
            } else if (r > 0.20000 && r < 0.20100) {
                this.spawnNewItem(ItemNames.ITEM_HEALTH_PACK);
            } else if (r > 0.30000 && r < 0.30010) {
                this.spawnNewItem(ItemNames.ITEM_SPROUT);
            } else if (r > 0.40000 && r < 0.40100) {
                this.spawnNewItem(ItemNames.ITEM_BRAIN);
            } else if (r > 0.50000 && r < 0.50002) {
                this.spawnNewItem(ItemNames.ITEM_CHIP);
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
                        this.adjustPlayerScore(100);
                        sound.play(ItemNames.ITEM_BRAIN + '_sfx');
                        if (!this.player.getIsBoosted()) {
                            this.setPlayerZombieMode();
                        }
                        break;
                    case ItemNames.ITEM_CHIP:
                        // increase recovery time
                        this.adjustPlayerScore(2500);
                        this.adjustPlayerHealth(100);
                        sound.play(ItemNames.ITEM_CHIP + '_sfx');
                        break;
                    case ItemNames.ITEM_HEALTH_PACK:
                        this.adjustPlayerScore(10);
                        this.adjustPlayerHealth(25);
                        sound.play(ItemNames.ITEM_HEALTH_PACK + '_sfx');
                        break;
                    case ItemNames.ITEM_KEY:
                        // add key (to get through doors)
                        break;
                    case ItemNames.ITEM_KEYCARD:
                        // add keycard (to get through doors)
                        break;
                    case ItemNames.ITEM_SPROUT:
                        this.adjustPlayerScore(500);
                        this.player.setIsBoosted(true);
                        this.player.setIsHit(10);
                        sound.play(ItemNames.ITEM_SPROUT + '_sfx');
                        break;
                    case ItemNames.ITEM_SHINY:
                        this.adjustPlayerScore(50);
                        sound.play(ItemNames.ITEM_SHINY + '_sfx');
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
                .add('girl1', '/assets/doc8.json')
                .add('girl2', '/assets/girl2.json')

                // Items
                .add(ItemNames.ITEM_BRAIN, '/assets/item-brain.json')
                .add(ItemNames.ITEM_CHIP, '/assets/item-chip.json')
                .add(ItemNames.ITEM_HEALTH_PACK, '/assets/item-health-pack.json')
                .add(ItemNames.ITEM_KEY, '/assets/item-key.json')
                .add(ItemNames.ITEM_KEYCARD, '/assets/item-keycard.json')
                .add(ItemNames.ITEM_SPROUT, '/assets/item-sprout.json')
                .add(ItemNames.ITEM_SHINY, '/assets/item-shiny.json')

                // Item sound effects
                .add(ItemNames.ITEM_BRAIN + '_sfx', '/assets/item-brain.wav')
                .add(ItemNames.ITEM_CHIP + '_sfx', '/assets/item-chip.wav')
                .add(ItemNames.ITEM_HEALTH_PACK + '_sfx', '/assets/item-health-pack.wav')
                // .add(ItemNames.ITEM_KEY, '/assets/item-key.json')
                // .add(ItemNames.ITEM_KEYCARD, '/assets/item-keycard.json')
                .add(ItemNames.ITEM_SPROUT + '_sfx', '/assets/item-sprout.wav')
                .add(ItemNames.ITEM_SHINY + '_sfx', '/assets/item-shiny.wav')

                // Zombie sfx
                .add('zombie1', '/assets/zombie1.wav')
                .add('zombie2', '/assets/zombie2.wav')
                .add('zombie3', '/assets/zombie3.wav')
                .add('zombie4', '/assets/zombie4.wav')
                .add('zombie5', '/assets/zombie5.wav')
                .add('zombie6', '/assets/zombie6.wav')
                .add('zombie7', '/assets/zombie7.wav')
                .add('zombie8', '/assets/zombie8.wav')
                .add('zombie9', '/assets/zombie9.wav')

                // Other sfx
                .add('player_hit_sfx', '/assets/player-hit.wav')
                .add('player_death', '/assets/player-death.mp3')
                .add('background_music', '/assets/background-music.wav')

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

                    if (r && r[ItemNames.ITEM_HEALTH_PACK + '_sfx']) {
                        //console.log(r[ItemNames.ITEM_HEALTH_PACK + '_sfx'].data.play());
                    }

                    sound.play('background_music', {volume: 0.3, loop: true});
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

        // Check zombie mode
        if (this.playerZombieTime > 0 && player.getZombie()) {
            this.playerZombieTime -= delta / 60;
            if (this.playerZombieTime < 0) {
                this.playerZombieTime = 0;
                player.setZombie(false);
                this.updatePlayerHealthUI();
            }
        }
    }

    private getDistance(pos1: {x: number, y: number}, pos2: {x: number, y: number}): number {
        return Math.sqrt(Math.pow(pos2.x - pos1.x, 2) + Math.pow(pos2.y - pos1.y, 2));
    }

    private updateZombies(delta: number): void {
        if (!this.map) return;

        const pPos = this.player.getPosition();
        if (!pPos) return;

        this.playerCloseZombies = 0;

        // Give zombie new path if it does not have one
        for (const zombie of this.zombies) {

            const zPos = zombie.getPosition();
            if (!zPos) continue;

            const distance = this.getDistance(pPos, zPos);

            if (distance < 100) {
                this.playerCloseZombies++;
            }

            if (!zombie.getCurrentPath() && !zombie.getFindingPath()) {
                if (this.map && pPos) {
                    const gridPos = this.map.getGridReferencePosition(zPos.x, zPos.y);
                    if (gridPos) {
                        zombie.setFindingPath(true);

                        // If close to player - follow, else
                        // Get random position to wander on the map
                        const newPos = distance < 100 ?
                            this.map.getGridReferencePosition(pPos.x, pPos.y) : this.getRandomGridPosition();

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

        // Randdomly play zombie sound (1- 5):
        const r = Math.round(Math.random() * 100000) / 100000;
        if (r > 0.20000 && r < 0.20700 * (1 + Math.min(this.playerCloseZombies, 6) / 100)) {
            const rS = Math.floor(Math.random() * 9) + 1;
            sound.play('zombie' + rS, {volume: 0.2 * Math.random() + 0.1});
        }

        // Update easy star on tick
        this.easyStar.calculate(); // working!
    }

    private updateViewport(): void {
        if (this.viewport && this.player) {
            const pos = this.player.getPosition();
            this.viewport.moveCenter(pos.x, pos.y);
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

    private hitPlayer(health: number, ignoreAlreadyHit?: boolean): void {
        if (!this.player.getIsHit() || ignoreAlreadyHit) {
            this.player.setIsHit();
        
            this.adjustPlayerHealth(-health);
            sound.play('player_hit_sfx');
        }
    }

    private adjustPlayerHealth(health: number): void {
        this.playerHealth += health;

        if (this.playerHealth <= 0) {
            this.playerHealth = 0;
            this.player.setIsDead(true);
            sound.play('player_death');
        } else if (this.playerHealth > 100) {
            this.playerHealth = 100;
        }

        this.updatePlayerHealthUI();
    }

    private adjustPlayerScore(score: number): void {
        this.playerScore += score;
        this.updatePlayerScoreUI();
    }

    private setPlayerZombieMode(): void {
        this.playerZombieTime = 10;
        this.player.setZombie(true);
        this.hitPlayer(25, true);
        this.updatePlayerHealthUI();
    }
}
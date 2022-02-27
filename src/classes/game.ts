import * as PIXI from 'pixi.js';
import { Viewport } from 'pixi-viewport';
import { sound } from '@pixi/sound';

import {Character} from './character';
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
    private player: Character = null!;

    private zombies: Character[] = [];
    private npcs: Character[] = [];
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

    private loadingUI: PIXI.Text = null!;
    private zombieRunLogoUI: PIXI.Sprite = null!;
    private clickToStartUI: PIXI.Text = null!;
    private gameOverUI: PIXI.Sprite = null!;

    private isLoading: boolean = true;
    private started: boolean = false;

    private elapsedTime: number = 0;

    constructor() {
        PIXI.settings.SCALE_MODE = PIXI.SCALE_MODES.NEAREST;
        PIXI.settings.ROUND_PIXELS = true;
        PIXI.settings.SORTABLE_CHILDREN = true;

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
        console.log('starting');
        this.loadAssets();
        this.input.start();

        // Watch stage click event
        if (this.app.view) {
            this.app.view.addEventListener('click', (e) => {
                if (!this.isLoading && this.assetsLoaded && !this.started) {
                    this.restart();
                }
            })
        }

        if (this.app) {
            this.app.ticker.add((delta: number) => {
                this.gameLoop(delta);
            });
        }
    }

    private loadMap(): void {
        if (!this.app || !this.app.loader.resources) return;

        const tileData: any = this.app.loader.resources['tiles-data'] ? this.app.loader.resources['tiles-data'].data : null;
        const tileTextures: any = this.app.loader.resources['tiles-image'] ? this.app.loader.resources['tiles-image'].texture : null;
        const mapData: any = this.app.loader.resources['map-data'] ? this.app.loader.resources['map-data'].data : null;

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

    private setupPlayer(): void {
        if (!this.app || !this.app.loader.resources) return;

        const playerFrames: string[] = this.app.loader.resources['girl1'] && this.app.loader.resources['girl1'].data ? 
            Object.keys(this.app.loader.resources['girl1'].data.frames) : null!;

        const p = new Character(playerFrames);
        this.player = p;
        this.updatePlayerHealthUI();
        this.updatePlayerScoreUI();

        const sprite = p.getSprite();

        this.viewport.addChild(sprite);
        this.viewport.follow(sprite);
    }

    private loadZombies(): void {
        if (!this.app || !this.app.loader.resources) return;

        // TO DO - Randomise
        const zombieFrames: string[] = this.app.loader.resources['girl2'] && this.app.loader.resources['girl2'].data ?
            Object.keys(this.app.loader.resources['girl2'].data.frames) : null!;

        if (this.zombies && this.zombies.length) {
            this.zombies.forEach(z => this.viewport.removeChild(z.getSprite()));
            this.zombies = [];
        }

        for (let i = 0; i < 1; i++) {
            const zombiePos = this.getRandomWorldPosition();

            if (zombiePos) {
                const zombie = new Character(zombieFrames);
                zombie.setPosition(zombiePos.x, zombiePos.y);
                zombie.setZombie(true);
                this.viewport.addChild(zombie.getSprite());
    
                this.zombies.push(zombie);
            }
        }
    }

    private loadNPCs(): void {
        if (!this.app || !this.app.loader.resources) return;

        if (this.npcs && this.npcs.length) {
            this.npcs.forEach(n => this.viewport.removeChild(n.getSprite()));
            this.npcs = [];
        }

        for (let i = 0; i < 10; i++) {
            const npcPos = this.getRandomWorldPosition();

            if (npcPos) {
                const r = Math.floor(Math.random() * 8) + 1;
                const resourceName = `doc${r}`;

                const npcFrames: string[] = this.app.loader.resources[resourceName] && this.app.loader.resources[resourceName].data ?
                    Object.keys(this.app.loader.resources[resourceName].data.frames) : null!;

                const npc = new Character(npcFrames, 0.5);
                npc.setPosition(npcPos.x, npcPos.y);
                this.viewport.addChild(npc.getSprite());

                this.npcs.push(npc);
            }
        }
    }

    private restart(): void {
        if (this.assetsLoaded) {
            this.updateZombieRunLogoUI(false);
            this.updateClickToStartUI(false);
            this.updateGameOverUI(false);
            this.started = true;

            // Reset player position
            this.player.setPosition(0, 0);
            this.player.setZombie(false);
            this.player.setIsDead(false);
            this.player.setIsBoosted(false);

            this.playerHealth = 100;
            this.playerScore = 0;
            this.updatePlayerHealthUI();
            this.updatePlayerScoreUI();

            // 3 seconds grace
            this.player.setIsHit(3);

            // Load zombies
            this.loadZombies();
            
            // Load NPCs
            this.loadNPCs();
        }
    }

    private updateLoadingUI(show?: boolean): void {
        if (this.loadingUI) {
            this.app.stage.removeChild(this.loadingUI);
            this.loadingUI = null!;
        }

        if (show) {
            const textStyle = new PIXI.TextStyle({
                fontFamily: "\"VT323\", Courier, monospace",
                fontSize: 24,
                fontWeight: 'bold',
                letterSpacing: 2,
                fill: 0xFFFFFF,
                strokeThickness: 4,
                align: 'right'
            });
    
            const text = new PIXI.Text('Loading...', textStyle);
            text.anchor.set(0.5);
            text.position.set(this.width / 2, this.height / 2);
    
            this.app.stage.addChild(text);
            this.loadingUI = text;
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

        const r = (this.playerHealth / 100);

        const color = this.player.getZombie() ? 0xAD235E : (
            r > 0.75 ? 0x980f11 : (
                r > 0.5 ? 0xac040c : (
                    r > 0.25 ? 0xe2111c : (
                        r > 0 ? 0xf40404 : 0x610505
                    )
                )
            )
        );

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
            fontFamily: "\"VT323\", Courier, monospace",
            fontSize: 24,
            fontWeight: 'bold',
            letterSpacing: 2,
            fill: 0xFFFFFF,
            strokeThickness: 4,
            align: 'right'
        });

        const text = new PIXI.Text('SCORE: ' + this.playerScore.toString(), textStyle);
        text.anchor.set(1, 0.5);
        text.position.set(this.width - 20, 32);

        this.app.stage.addChild(text);
        this.playerScoreUI = text;
    }

    private updateZombieRunLogoUI(show?: boolean): void {
        if (this.zombieRunLogoUI) {
            this.app.stage.removeChild(this.zombieRunLogoUI);
            this.zombieRunLogoUI = null!;
        }

        if (show) {
            const texture = this.app.loader.resources['zombie-run-logo'] ? this.app.loader.resources['zombie-run-logo'].texture : null;
            if (!texture) return;

            const sprite = new PIXI.Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.position.set(this.width / 2, this.height / 2 - 50);

            this.app.stage.addChild(sprite);
            this.zombieRunLogoUI = sprite;
        }
    }

    private updateClickToStartUI(show?: boolean): void {
        if (this.clickToStartUI) {
            this.app.stage.removeChild(this.clickToStartUI);
            this.clickToStartUI = null!;
        }

        if (show) {
            const textStyle = new PIXI.TextStyle({
                fontFamily: "\"VT323\", Courier, monospace",
                fontSize: 24,
                fontWeight: 'bold',
                letterSpacing: 2,
                fill: 0xFFD300,
                strokeThickness: 4,
                align: 'right'
            });
                
            const text = new PIXI.Text('Click to Start', textStyle);
            text.anchor.set(0.5);
            text.position.set(this.width / 2, this.height / 2 + 80);
    
            this.app.stage.addChild(text);
            this.clickToStartUI = text;
        }
    }

    private updateGameOverUI(show?: boolean): void {
        if (this.gameOverUI) {
            this.app.stage.removeChild(this.gameOverUI);
            this.gameOverUI = null!;
        }

        if (show) {
            const texture = this.app.loader.resources['game-over'] ? this.app.loader.resources['game-over'].texture : null;
            if (!texture) return;

            const sprite = new PIXI.Sprite(texture);
            sprite.anchor.set(0.5);
            sprite.position.set(this.width / 2, this.height / 2 - 50);

            this.app.stage.addChild(sprite);
            this.gameOverUI = sprite;
        }
    }

    private spawnNewItem(itemType: ItemNames): void {
        if (this.app && this.app.loader && this.app.loader.resources) {
            const itemPos = this.getRandomWorldPosition();

            if (itemPos) {
                const frames = Object.keys(this.app.loader.resources[itemType].data.frames);
                const item = new Item(frames, itemPos.x, itemPos.y, itemType);
    
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
            
            if (collected) {
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
        this.isLoading = true;
        this.updateLoadingUI(true);

        if (this.app) {
            this.app.loader

                // Logo
                .add('zombie-run-logo', '/assets/zombie-run-logo.png')

                // Game over image
                .add('game-over', '/assets/game-over.png')

                // Zombie sprites
                .add('girl1', '/assets/doc8.json')
                .add('girl2', '/assets/girl2.json')

                // Doctor/Zombie Sprites
                .add('doc1', '/assets/doc1.json')
                .add('doc2', '/assets/doc2.json')
                .add('doc3', '/assets/doc3.json')
                .add('doc4', '/assets/doc4.json')
                .add('doc5', '/assets/doc5.json')
                .add('doc6', '/assets/doc6.json')
                .add('doc7', '/assets/doc7.json')
                .add('doc8', '/assets/doc8.json')

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
                    this.updateLoadingUI(false);
                    this.isLoading = false;
                    this.assetsLoaded = true;

                    this.loadMap();
                    this.setupPlayer();

                    this.updateZombieRunLogoUI(true);
                    this.updateClickToStartUI(true);
                    sound.play('background_music', {volume: 0.3, loop: true});
                });
        }
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
        this.elapsedTime += delta;

        if (this.started) {
            // Update player
            this.updatePlayer(delta);

            // Update zombie position
            this.updateZombies(delta);

            // Update NPC positions
            this.updateNPCs(delta);

            this.updateZSorting();
            this.checkCollisions();

            // Update viewport
            this.updateViewport();

            // Spawn items
            this.spawnItems();
            this.updateItemLife(delta);

            // Update easy star on tick
            this.easyStar.calculate();
        } else {
            if (this.zombieRunLogoUI || this.gameOverUI) {
                (this.zombieRunLogoUI || this.gameOverUI).position.set(this.width / 2, this.height / 2 - 50 + 8 * Math.sin(this.elapsedTime / 20));
            }

            if (this.clickToStartUI) {
                this.clickToStartUI.alpha = Math.ceil(Math.sin(this.elapsedTime / 15));
            }
        }
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
                        // If close to player - follow, else
                        // Get random position to wander on the map
                        const newPos = distance < 100 ?
                            this.map.getGridReferencePosition(pPos.x, pPos.y) : this.getRandomGridPosition();

                        if (newPos) {
                            zombie.setFindingPath(true);
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
            }

            zombie.onPathTick();
            zombie.update(delta);
        }

        // Randdomly play zombie sound (1- 5):
        const r = Math.round(Math.random() * 100000) / 100000;
        if (r > 0.20000 && r < 0.20700 * (1 + Math.min(this.playerCloseZombies, 6) / 100)) {
            this.playRandomZombieSound();
        }
    }

    private playRandomZombieSound() {
        const r = Math.floor(Math.random() * 9) + 1;
        sound.play('zombie' + r, {volume: 0.2 * Math.random() + 0.1});
    }

    private updateNPCs(delta: number): void {
        if (!this.map) return;

        // Give NPC a new path if it does not have one
        for (const npc of this.npcs) {

            const nPos = npc.getPosition();
            if (!nPos) continue;

            if (!npc.getCurrentPath() && !npc.getFindingPath()) {
                const gridPos = this.map.getGridReferencePosition(nPos.x, nPos.y);
                    if (gridPos) {
                        const newPos = this.getRandomGridPosition(); // TO DO

                        if (newPos) {
                            npc.setFindingPath(true);
                            this.easyStar.findPath(gridPos.x, gridPos.y, newPos.x, newPos.y, (path) => {
                                if (path) {
                                    const adjustedPath = this.map.getMapPositionsFromPath(path);
                                    npc.setNewPath(adjustedPath);
                                }
    
                                npc.setFindingPath(false);
                            });
                        }                        
                    }
            }

            npc.onPathTick();
            npc.update(delta);
        }
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
        this.viewport.children.sort((a, b) => {
            if (a.name.startsWith('map_') && a.name.includes('Below') && !b.name.includes('Below')) {
                return -1;
            } else if (b.name.startsWith('map_') && b.name.includes('Below') && !a.name.includes('Below')) {
                return 1;
            } else if (a.name.startsWith('map_') && a.name.includes('Above')) {
                return 1;
            } else if (b.name.startsWith('map_') && b.name.includes('Above')) {
                return -1;
            }

            return this.ySorting(a.y, b.y);
        });
    }

    private checkCollisions(): void {
        this.checkPlayerZombieCollisions();
        this.checkPlayerMapCollisions();
        this.checkPlayerItemCollisions();
        this.checkZombieNpcCollisions();
    }

    private checkPlayerZombieCollisions(): void {
        if (this.player && this.zombies && this.zombies.length > 0) {
            const player = this.player;
            const zombies = this.zombies.map(z => z.getSprite());

            // Zombie hit the player
            (this.bump as any).hit(player.getSprite(), zombies, false, false, false, (collision: any, sprite: any) => {
                this.hitPlayer(5);
            });
        }
    }

    private checkPlayerMapCollisions(): void {
        if (this.player && this.viewport && this.viewport.children) {
            const player = this.player;

            // Get map elements that have collisions
            const mapCollisionTiles = this.viewport.children.filter(c => c.name.toLowerCase().endsWith('_collide'));

            // Force player to collide with map
            (this.bump as any).hit(player.getSprite(), mapCollisionTiles, true, false, false);
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

    private checkZombieNpcCollisions(): void {
        if (this.zombies && this.zombies.length > 0 && this.npcs && this.npcs.length) {
            const zombies = this.zombies.map(z => z.getSprite());

            const npcsToSplice: number[] = [];

            for (let i = 0; i < this.npcs.length; i++) {
                const hit = (this.bump as any).hit(this.npcs[i].getSprite(), zombies, false, false, false);

                // If a zombie hits an NPC they become a zombie
                if (hit) {
                    this.npcs[i].setZombie(true);
                    this.playRandomZombieSound();
                    npcsToSplice.push(i);
                }
            }

            // Switch npcs into zombie array
            if (npcsToSplice && npcsToSplice.length) {
                npcsToSplice.forEach(i => {
                    const npc = this.npcs.splice(i, 1);
                    this.zombies.push(...npc);
                });
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
            this.updateGameOverUI(true);
            
            this.updateClickToStartUI(true);
            this.started = false;
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
import * as PIXI from 'pixi.js';

import {Player} from './player';
import {Input} from './input';

export class Game {

    private app: PIXI.Application = null!;
    private input: Input = null!;
    private player: Player = null!;
    

    gameLoop: ((delta: number) => void) = (delta: number) => {
        if (this.player && this.input) {
            const player = this.player;
            player.movingForward = this.input.getKeyState(87) || false; // w
            player.movingBackward = this.input.getKeyState(83) || false; // d
            player.movingLeft = this.input.getKeyState(65) || false; // a
            player.movingRight = this.input.getKeyState(68) || false; // d
            player.update(delta);
        }
    };

    constructor() {
        // App
        const app = new PIXI.Application({
            width: 800,
            height: 600,
            backgroundColor: 0xff00ff,
            resolution: window.devicePixelRatio || 1
        });

        app.stage.addChild(new PIXI.Container());
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
            this.app.ticker.add(this.gameLoop);
        }
    }

    private loadAssets() {
        if (this.app) {
            // Load first girl character sprite
            this.app.loader
                .add('girl1', '/assets/girl1.json')
                .load((_, r) => {
                    if (r && r['girl1']) {
                        const res = r['girl1'];
                        const frameNames = res.data && res.data.frames ? Object.keys(res.data.frames) : [];

                        const p = new Player(frameNames);
                        this.player = p;
            
                        this.app.stage.addChild(p.getSprite());
                    }
                });
        }
    }

    private watchGameEvents() {
        // Toggle the zombie mode when the user presses space
        this.input.onKeyPress(32)
            .subscribe(() => {
                this.player.setZombie(!this.player.getZombie());
            })
    }

    
}
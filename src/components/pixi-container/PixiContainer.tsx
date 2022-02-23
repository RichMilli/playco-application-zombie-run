import * as PIXI from 'pixi.js';
import React from 'react';

import {Game} from './../../classes/game';


interface PixiContainerProperties {
}

interface PixiContainerState {
    app: PIXI.Application,
    game: Game
}

export class PixiContainer extends React.Component<PixiContainerProperties, PixiContainerState> {    

    constructor(props: any) {
        super(props);

        const pixiGameApp = this.createPixiGameApp();
        
        this.state = {
            app: pixiGameApp.app,
            game: pixiGameApp.game
        };
    }

    private createPixiGameApp(): {game: Game, app: PIXI.Application} {
        const game = new Game();
        const app = game.getApp();
        game.start();
      
        return {
            game: game,
            app: app
        }
    }    
    
    render() {
        return (
            <div ref={ref => ref?.appendChild(this.state.app.view)}></div>
        );
    };
}
    

    
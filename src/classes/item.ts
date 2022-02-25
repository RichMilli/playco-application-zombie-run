import * as PIXI from 'pixi.js';
import { Observable, Subject } from 'rxjs';
import { ItemNames } from '../enums/item-names';

export class Item {    
    private readonly animationSpeed: number = 0.05;
    
    private onExpireSubject: Subject<Item> = new Subject<Item>();

    private readonly itemType: ItemNames;
    private sprite: PIXI.AnimatedSprite;
    private lifeTime: number = 10; // lives for 10 seconds


    constructor(frameNames: string[], x: number, y: number, itemType: ItemNames) {
        this.itemType = itemType;
        this.setLifeTime();

        this.sprite = this.createSprite(frameNames, x, y);
    }

    private setLifeTime(): void {
        let lifeTime = 0;

        switch(this.itemType)  {
            case ItemNames.ITEM_BRAIN:
                lifeTime = 30; 
                break;
            case ItemNames.ITEM_CHIP:
                lifeTime = 30;
                break;
            case ItemNames.ITEM_HEALTH_PACK:
                lifeTime = 30;
                break;
            case ItemNames.ITEM_KEY:
                lifeTime = null!;
                break;
            case ItemNames.ITEM_KEYCARD:
                lifeTime = null!;
                break;
            case ItemNames.ITEM_SPROUT:
                lifeTime = 30;
                break;
            case ItemNames.ITEM_SHINY:
                lifeTime = 10;
                break;
        }

        this.lifeTime = lifeTime;
    }

    private createSprite(frameNames: string[], x: number, y: number): PIXI.AnimatedSprite {
        const frames = frameNames.map(n => {
            return PIXI.Texture.from(n);
        });

        const sprite = new PIXI.AnimatedSprite(frames);
        sprite.x = x;
        sprite.y = y;
        sprite.name = 'item';
        sprite.anchor.set(0.5);
        sprite.animationSpeed = this.animationSpeed;
        sprite.play();

        return sprite;
    }

    getItemType(): ItemNames {
        return this.itemType;
    }

    getSprite(): PIXI.AnimatedSprite {
        return this.sprite;
    }

    update(delta: number): void {
        if (this.lifeTime) {
            // Hit Time
            if (this.lifeTime > 0) {
                this.lifeTime -= delta / 60;
                if (this.lifeTime < 0) {
                    this.lifeTime = 0;
                    this.onExpireSubject.next(this);
                    this.onExpireSubject.complete();
                }
            }

            // Blink with 5 seconds remaining
            if (this.lifeTime < 5) {
                this.sprite.alpha = this.lifeTime > 0 ? 
                    Math.max((Math.sin(this.lifeTime * 25) + 1) / 2, 0.4) : 1;
            }
        }
        
    }

    onExpire(): Observable<Item> {
        return this.onExpireSubject;
    }
}
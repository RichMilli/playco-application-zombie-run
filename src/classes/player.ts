import * as PIXI from 'pixi.js';

interface PlayerStateTextures {
    forward: PIXI.Texture[];
    left: PIXI.Texture[];
    right: PIXI.Texture[];
    backward: PIXI.Texture[];
}

export class Player {
    x: number = 0;
    y: number = 0;

    private readonly anchor: number = 0.5;
    private readonly animationSpeed: number = 0.1;
    private readonly speed: number = 1;
    private readonly zombieSpeed: number = 0.5;

    private prevIsMoving = false;

    private isZombie: boolean = false;
    
    movingForward = false;
    movingBackward = false;
    movingLeft = false;
    movingRight = false;

    private textures: PlayerStateTextures;
    private zombieTextures: PlayerStateTextures;

    private sprite: PIXI.AnimatedSprite;

    constructor(frameNames: string[], isZombie?: boolean) {
        const frames = frameNames.map(n => {
            return PIXI.Texture.from(n);
        });

        if (!frames || frames.length !== 24) console.error('Invalid frame count');

        this.isZombie = !!isZombie;

        // Normal character textures
        this.textures = {
            forward: frames.slice(0, 3),
            left: frames.slice(3, 6),
            right: frames.slice(6, 9),
            backward: frames.slice(9, 12)
        };

        // Zombies textures
        this.zombieTextures = {
            forward: frames.slice(12, 15),
            left: frames.slice(15, 18),
            right: frames.slice(18, 21),
            backward: frames.slice(21, 24)
        };

        const sprite = new PIXI.AnimatedSprite(this.isZombie ? this.zombieTextures.forward : this.textures.forward);
        sprite.x = 20;
        sprite.y = 20;
        sprite.anchor.set(this.anchor);
        sprite.animationSpeed = this.animationSpeed;
        sprite.gotoAndStop(1);

        this.sprite = sprite;
    }

    getSprite(): PIXI.AnimatedSprite {
        return this.sprite;
    }

    update(delta: number): void {
        const x = Number(this.movingRight) - Number(this.movingLeft);
        const y = Number(this.movingForward) - Number(this.movingBackward);

        const isMoving = (x !== 0) || (y !== 0);

        // Update texture frames based on direction character is facing
        let textures = this.sprite.textures;

        if (y < 0) {
            textures = this.isZombie ? this.zombieTextures.forward : this.textures.forward;
        } else if (y > 0) {
            textures = this.isZombie ? this.zombieTextures.backward : this.textures.backward;
        }

        if (x < 0) {
            textures = this.isZombie ? this.zombieTextures.left : this.textures.left;
        } else if (x > 0) {
            textures = this.isZombie ? this.zombieTextures.right : this.textures.right;
        }        

        if (this.sprite.textures !== textures) {
            this.sprite.textures = textures;
            this.sprite.play();
        }

        if (!this.prevIsMoving && isMoving) {
            this.sprite.play();
        } else if (this.prevIsMoving && !isMoving) {
            this.sprite.gotoAndStop(1);
        }

        this.prevIsMoving = isMoving;  

        const speed = (this.isZombie ? this.zombieSpeed : this.speed)
        this.sprite.x += speed * x * delta;
        this.sprite.y -= speed * y * delta;
    }

    setZombie(isZombie: boolean): void {
        this.isZombie = isZombie;
    }

    getZombie(): boolean {
        return this.isZombie;
    }
}
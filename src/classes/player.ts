import * as PIXI from 'pixi.js';

interface PlayerStateTextures {
    forward: PIXI.Texture[];
    left: PIXI.Texture[];
    right: PIXI.Texture[];
    backward: PIXI.Texture[];
}

export class Player {
    private prevDirection: [number, number] = [0, 0];

    private readonly animationSpeed: number = 0.1;
    private readonly speed: number = 1;
    private readonly zombieSpeed: number = 0.5;
    private readonly boostSpeed = 2;

    private isMoving: boolean = false;
    private prevIsMoving: boolean = false;

    private isDead: boolean = false;
    private isZombie: boolean = false;
    
    private movingForward = false;
    private movingBackward = false;
    private movingLeft = false;
    private movingRight = false;

    private deadTextures: PIXI.Texture[];
    private textures: PlayerStateTextures;
    private zombieTextures: PlayerStateTextures;

    private sprite: PIXI.AnimatedSprite;

    private findingPath: boolean = false;
    private currentPath: {x: number, y: number}[] = null!;
    private currentTarget: {x: number, y: number} = null!;

    private hitTime: number = 0;
    private isBoosted: boolean = false;

    constructor(frameNames: string[], isZombie?: boolean) {
        const frames = frameNames.map(n => {
            return PIXI.Texture.from(n);
        });

        if (!frames || frames.length !== 26) console.error('Invalid frame count');

        this.isZombie = !!isZombie;

        // Dead textures
        this.deadTextures = frames.slice(0, 2);

        // Normal character textures
        this.textures = {
            forward: frames.slice(2, 5),
            left: frames.slice(5, 8),
            right: frames.slice(8, 11),
            backward: frames.slice(11, 14)
        };

        // Zombies textures
        this.zombieTextures = {
            forward: frames.slice(14, 17),
            left: frames.slice(17, 20),
            right: frames.slice(20, 23),
            backward: frames.slice(23, 26)
        };

        const sprite = new PIXI.AnimatedSprite(this.isZombie ? this.zombieTextures.forward : this.textures.forward);
        sprite.x = 0;
        sprite.y = 0;
        sprite.name = 'player';
        sprite.anchor.set(0.5);
        sprite.animationSpeed = this.animationSpeed;
        sprite.gotoAndStop(1);

        this.sprite = sprite;
    }

    getSprite(): PIXI.AnimatedSprite {
        return this.sprite;
    }

    getStateTexture(x: number, y: number): PIXI.Texture[] | PIXI.FrameObject[] {
        if (this.isDead) return this.deadTextures;

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

        return textures;
    }

    update(delta: number): void {
        if (this.isDead) return;

        const x = Number(this.movingRight) - Number(this.movingLeft);
        const y = Number(this.movingForward) - Number(this.movingBackward);

        const isMoving = (x !== 0) || (y !== 0);

        // Update texture frames based on direction character is facing
        const textures = this.getStateTexture(x, y);

        let textureChanged = false;

        if (this.sprite.textures !== textures) {
            this.sprite.textures = textures;
            textureChanged = true;
        }

        if ((!this.prevIsMoving && isMoving) || textureChanged) {
            this.prevDirection = [x, y];
            this.sprite.play();
        } else if (this.prevIsMoving && !isMoving) {
            this.sprite.gotoAndStop(1);
        }

        this.prevIsMoving = this.isMoving;  
        this.isMoving = isMoving;

        const speed = this.isBoosted ?
            this.boostSpeed : (this.isZombie ? this.zombieSpeed : this.speed);
        this.sprite.x += speed * x * delta;
        this.sprite.y -= speed * y * delta;

        // Hit Time - also used for boost
        if (this.hitTime > 0) {
            this.hitTime -= delta / 60;
            if (this.hitTime < 0) {
                this.hitTime = 0;

                if (this.isBoosted) {
                    this.isBoosted = false;
                }
            }
        }

        // Hit animation
        this.sprite.alpha = this.hitTime > 0 ? 
            Math.max((Math.sin(this.hitTime * 25) + 1) / 2, 0.4) : 1;
    }

    setZombie(isZombie: boolean): void {
        this.isZombie = isZombie;

        const textures = this.getStateTexture(this.prevDirection[0], this.prevDirection[1]);

        if (this.sprite.textures !== textures) {
            this.sprite.textures = textures;
        }

        if (this.isMoving) {
            this.sprite.play();
        } else {
            this.sprite.gotoAndStop(1);
        }
    }

    getZombie(): boolean {
        return this.isZombie;
    }

    setIsDead(isDead: boolean): void {
        this.isDead = isDead;

        const textures = this.getStateTexture(this.prevDirection[0], this.prevDirection[1]);

        if (this.sprite.textures !== textures) {
            this.sprite.textures = textures;
        }

        if (this.isMoving && !isDead) {
            this.sprite.play();
        } else {
            this.sprite.gotoAndStop(1);
        }
    }

    getIsDead(): boolean {
        return this.isDead;
    }

    setPosition(x: number, y: number): void {
        this.sprite.x = x;
        this.sprite.y = y;
    }

    getPosition(): {x: number, y: number} {
        return {x: this.sprite.x, y: this.sprite.y};
    }

    setIsMovingForward(forward: boolean): void {
        this.movingForward = forward;
    }

    setIsMovingBackward(backward: boolean): void {
        this.movingBackward = backward;
    }

    setIsMovingLeft(left: boolean): void {
        this.movingLeft = left;
    }

    setIsMovingRight(right: boolean): void {
        this.movingRight = right;
    }

    setZIndex(zIndex: number): void {
        if (this.sprite) {
            this.sprite.zIndex = zIndex;
        }
    }

    followPosition(targetX: number, targetY: number): void {
        const x = this.sprite.x;
        const y = this.sprite.y;

        const dx = targetX - x;
        const dy = targetY - y;

        this.movingLeft = (Math.ceil(dx) < 0);
        this.movingRight = (Math.ceil(dx) > 0);

        this.movingForward = (Math.ceil(dy) < 0);
        this.movingBackward = (Math.ceil(dy) > 0);
    }

    getBounds(): PIXI.Rectangle {
        return this.sprite.getBounds();
    }

    setNewPath(path: { x: number, y: number }[]): void {
        this.currentPath = path;
    }

    getCurrentPath(): { x: number, y: number }[] {
        return this.currentPath;
    }

    setFindingPath(findingPath: boolean): void {
        this.findingPath = findingPath;
    }

    getFindingPath(): boolean {
        return this.findingPath;
    }

    onPathTick(): void {
        if (this.currentPath) {
            if (!this.currentTarget) {
                const target = this.currentPath.shift();
                this.currentTarget = target ? target : null!;
            }

            if (this.currentTarget) {
                this.followPosition(this.currentTarget.x, this.currentTarget.y);

                // Reached target
                if (this.currentTarget.x === Math.floor(this.sprite.x) && this.currentTarget.y === Math.floor(this.sprite.y)) {
                    this.currentTarget = null!;
                    if (this.currentPath && this.currentPath.length === 0) {
                        this.currentPath = null!;
                    }
                }
            }
        }
    }

    setIsHit(hitTime?: number): void {
        this.hitTime = hitTime || 1; // hit delay
    }

    getIsHit(): boolean {
        return !!this.hitTime;
    }

    getIsBoosted(): boolean {
        return this.isBoosted;
    }

    setIsBoosted(boosted: boolean): void {
        this.isBoosted = boosted;
    }
}
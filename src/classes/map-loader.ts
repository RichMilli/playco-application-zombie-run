import * as PIXI from 'pixi.js';

export interface GridItem {
    x: number,
    y: number,
    val: number;
}

export class MapLoader {
    private mapTextures: PIXI.Texture[] = [];
    private mapSprites: PIXI.Sprite[] = [];
    private collisionGrid: GridItem[][] = [];

    constructor(textureMetadata?: any, tileTexture?: PIXI.BaseTexture, mapData?: any) {
        if (textureMetadata && tileTexture && mapData) {
            this.loadTileMap(textureMetadata, tileTexture, mapData);
        }
    }

    public getGridReferencePosition(x: number, y: number): {x: number, y: number} {
        let i = -1;
        let j = 0;

        for (j = 0; j < this.collisionGrid.length; j++) {
            i = this.collisionGrid[j].findIndex(g => (g.x === Math.round(x / 16) * 16) && (g.y === Math.round(y / 16) * 16));
            if (i > -1) {
                break;
            }
        }

        if (i > -1) {
            return {
                x: i,
                y: j
            };
        }

        return null!;
    }

    public getMapPositionsFromPath(path: {x: number, y: number}[]): ({x: number, y: number})[] {
        if (path && path.length) {
            const adjustedPath = [];

            for (const p of path) {
                const gridItem = this.collisionGrid[p.y] && this.collisionGrid[p.y][p.x] ?
                    this.collisionGrid[p.y][p.x] : null;

                if (gridItem) {
                    adjustedPath.push({
                        x: gridItem.x,
                        y: gridItem.y
                    });
                }
            }

            return adjustedPath;
        }
        
        return null!;
    }

    public getRandomGridGroundPosition(): {x: number, y: number} {
        let searching = true;

        let y: number = null!;
        let x: number = null!;

        if (this.collisionGrid) {
            while (searching) {
                y = Math.floor(this.collisionGrid.length * Math.random());
                x = Math.floor(this.collisionGrid[0].length * Math.random());
    
                if (this.collisionGrid[y] && this.collisionGrid[y][x] && this.collisionGrid[y][x].val === 0) {
                    searching = false;
                }
            }
        }

        return x && y ? {
            x: x,
            y: y
        } : null!;
    }

    private cutUpTexture(textureMetadata: any, tileTexture: PIXI.BaseTexture): void {
        // Load textures
        const tileWidth = textureMetadata.tilewidth;
        const tileHeight = textureMetadata.tileheight;
        const h = textureMetadata.imagewidth / tileWidth;
        const v = textureMetadata.imageheight / tileHeight;

        // Load all the image slices into seperate textures
        for (let i = 0; i < h * v; i++) {
            let x = i % h;
            let y = Math.floor(i / h);

            this.mapTextures.push(new PIXI.Texture(
                tileTexture,
                new PIXI.Rectangle(x * tileWidth, y * tileHeight, tileWidth, tileHeight)
            ));
        }
    }

    private loadMapData(mapData: any): void {
        const tempGrid: GridItem[] = [];

        // Load map layers
        if (mapData.layers) {
            mapData.layers.forEach((l: any) => {
                if (l.chunks) {
                    l.chunks.forEach((c: any) => {
                        if (c.data) {
                            c.data.forEach((d: number, i: number) => {
                                const texture = d > 0 ? this.mapTextures[d - 1] : null;

                                if (!texture) return;

                                const x = i % c.width;
                                const y = Math.floor(i / c.width);

                                const sx = (c.x + x) * c.width;
                                const sy = (c.y + y) * c.height;

                                const sprite = new PIXI.Sprite(texture);
                                sprite.name = 'map_' + l.name;
                                sprite.x = sx;
                                sprite.y = sy;
                                sprite.anchor.set(0.5);

                                tempGrid.push({
                                    x: sprite.x,
                                    y: sprite.y,
                                    val: l.name.toLowerCase().endsWith('_collide')
                                });

                                this.mapSprites.push(sprite);
                            });
                        }
                    });
                }
            });
        }

        // Construct collision grid for path finding
        const minX = Math.min(...tempGrid.map(g => g.x));
        const maxX = Math.max(...tempGrid.map(g => g.x));

        const minY = Math.min(...tempGrid.map(g => g.y));
        const maxY = Math.max(...tempGrid.map(g => g.y));
        
        const size = 16;

        const newGrid: GridItem[][] = [];

        for (let y = minY; y <= maxY; y += size) {
            const row = [];

            for (let x = minX; x <= maxX; x+= size) {
                row.push({
                    x: x,
                    y: y,
                    val: Number(!!tempGrid.find(g => g.x === x && g.y === y && g.val))
                });
            }

            newGrid.push(row);
        }

        this.collisionGrid = newGrid;
    }

    loadTileMap(textureMetadata: any, tileTexture: PIXI.BaseTexture, mapData: any): void {
        this.cutUpTexture(textureMetadata, tileTexture);
        this.loadMapData(mapData);
    }

    getMapSprites(): PIXI.Sprite[] {
        return this.mapSprites;
    }

    getCollisionGrid(): GridItem[][] {
        return this.collisionGrid;
    }

    
}
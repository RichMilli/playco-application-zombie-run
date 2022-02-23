import * as PIXI from 'pixi.js';

export class MapLoader {
    private mapTextures: PIXI.Texture[] = [];
    private mapSprites: PIXI.Sprite[] = [];

    constructor(textureMetadata?: any, tileTexture?: PIXI.BaseTexture, mapData?: any) {
        if (textureMetadata && tileTexture && mapData) {
            this.loadTileMap(textureMetadata, tileTexture, mapData);
        }
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
        if (mapData.layers) {
            mapData.layers.forEach((l: any, i: number) => {
                // TO DO - Order the layers correctly
                // console.log('layer', l);
                if (l.chunks) {
                    l.chunks.forEach((c: any) => {
                        // console.log('chunk', c);

                        if (c.data) {
                            c.data.forEach((d: number, j: number) => {
                                const texture = d > 0 ? this.mapTextures[d - 1] : null;

                                if (!texture) return;

                                let x = j % c.width;
                                let y = Math.floor(j / c.width);

                                const sprite = new PIXI.Sprite(texture);
                                sprite.name = 'map';
                                sprite.x = (c.x + x + 16) * c.width;
                                sprite.y = (c.y + y) * c.height;
                                sprite.anchor.set(0.5);

                                this.mapSprites.push(sprite);
                            });
                        }
                    });
                }
            });
        }    
    }

    loadTileMap(textureMetadata: any, tileTexture: PIXI.BaseTexture, mapData: any): void {
        this.cutUpTexture(textureMetadata, tileTexture);
        this.loadMapData(mapData);
    }

    getMapSprites(): PIXI.Sprite[] {
        return this.mapSprites;
    }
}
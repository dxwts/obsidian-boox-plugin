import { fabric } from 'fabric'

import { getResourceUrl } from '../util/oss_util'

class ImageShape {
    origX = 0
    origY = 0
    constructor(canvas, opts = {}) {
        this.opts = opts
        this.canvas = canvas
        this.className = 'Image'
        this.shapeType = 19
        this.opts.resource.type = 0
        this.center = canvas.getCenter()
        this.render()
    }

    async render() {
        const url = await getResourceUrl(this.opts.resource.ossUrl)
        if (!url) {
            return
        }
        const zoom = this.canvas.getZoom()
        const canvasWidth = this.canvas.width / zoom
        const canvasHeight = this.canvas.height / zoom
        fabric.Image.fromURL(
            url,
            (img) => {
                img.left = canvasWidth / 2 - img.width / 2
                img.top = canvasHeight / 2 - img.height / 2

                img.start = {
                    x: img.left,
                    y: img.top,
                }
                img.end = {
                    x: img.left + img.width,
                    y: img.top + img.height,
                }

                img.originLeft = img.left
                img.originTop = img.top
                img.originCenter = img.getCenterPoint()

                img.added = true
                img.shapeType = this.shapeType
                img.resource = this.opts.resource
                this.canvas.add(img).setActiveObject(img)
                this.canvas.requestRenderAll()
                // this.canvas.centerObject(img)
            },
            {
                crossOrigin: 'anonymous',
            }
        )
    }
}

export default ImageShape

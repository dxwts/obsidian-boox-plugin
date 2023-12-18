import { fabric } from 'fabric'
class Rectangle {
    origX = 0
    origY = 0
    shape = null
    constructor(canvas, opts = {}) {
        this.opts = opts
        this.canvas = canvas
        this.isDrawing = false
        this.className = 'Rectangle'
        this.shapeType = 1
        this.bindEvents()
    }

    bindEvents() {
        this.canvas.on('mouse:down', (o) => {
            this.onMouseDown(o)
        })
        this.canvas.on('mouse:move', (o) => {
            this.onMouseMove(o)
        })
        this.canvas.on('mouse:up', (o) => {
            this.onMouseUp(o)
        })
        this.canvas.on('object:moving', () => {
            this.disable()
        })
    }

    onMouseUp(o) {
        if (this.isEnable()) {
            this.disable()
            const pointer = this.canvas.getPointer(o.e)
            this.shape.set({
                hasBorders: true,
                hasControls: true,
                added: true,
            })
            this.shape.start = {
                x: this.origX,
                y: this.origY,
            }
            this.shape.end = {
                x: pointer.x,
                y: pointer.y,
            }
            this.shape.originCenter = this.shape.getCenterPoint()
            this.canvas.requestRenderAll()
            this.canvas.fire('object:modified', { target: this.shape })
        }
    }

    onMouseMove(o) {
        if (!this.isEnable()) {
            return
        }

        const pointer = this.canvas.getPointer(o.e)

        if (this.origX > pointer.x) {
            this.shape.set({
                left: Math.abs(pointer.x),
            })
        }
        if (this.origY > pointer.y) {
            this.shape.set({
                top: Math.abs(pointer.y),
            })
        }

        this.shape.set({
            width: Math.abs(this.origX - pointer.x),
        })
        this.shape.set({
            height: Math.abs(this.origY - pointer.y),
        })
        this.shape.setCoords()
        this.canvas.requestRenderAll()
    }

    onMouseDown(o) {
        this.enable()

        const pointer = this.canvas.getPointer(o.e)
        this.origX = pointer.x
        this.origY = pointer.y

        const opts = {
            left: this.origX,
            top: this.origY,
            originX: 'left',
            originY: 'top',
            width: pointer.x - this.origX,
            height: pointer.y - this.origY,
            strokeWidth: this.opts.strokeWidth || 1,
            stroke: this.opts.strokeColor || 'black',
            fill: this.opts.fill || '',
            selectable: false,
            hasBorders: false,
            hasControls: false,
        }

        if (this.opts.strokeDashArray) {
            opts.strokeDashArray = this.opts.strokeDashArray
        }

        if (this.canvas.meta.color) {
            opts.stroke = this.canvas.meta.color
        }

        this.shape = new fabric.Rect(opts)
        this.shape.shapeType = this.shapeType
        this.shape.added = false
        this.canvas.add(this.shape)
        this.canvas.requestRenderAll()
    }

    isEnable() {
        return this.isDrawing
    }

    enable() {
        this.isDrawing = true
    }

    disable() {
        this.isDrawing = false
    }
}

export default Rectangle

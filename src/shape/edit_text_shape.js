import { fabric } from 'fabric'

import TextStyleModel from '../model/text_style_model'

class EditTextShape {
    origX = -100
    origY = -100
    textSize = 50
    textBold = ''
    textItalic = ''
    textUnderline = false
    color = 'black'
    constructor(canvas, opts = {}) {
        this.opts = opts
        this.canvas = canvas
        this.className = 'EditText'
        this.shapeType = 16
        this.bindEvents()
    }

    bindEvents() {
        this.canvas.on('mouse:down', (o) => {
            this.onMouseDown(o)
        })
        this.canvas.on('text:changed', (e) => {
            const textBox = e.target
            textBox.set({
                end: {
                    x: textBox.left + textBox.width,
                    y: textBox.top + textBox.height,
                },
            })
            const textWidthUnderCursor = textBox.getLineWidth(
                textBox.get2DCursorLocation().lineIndex
            )
            if (textBox.maxWidth < textWidthUnderCursor) {
                textBox.set('maxWidth', textWidthUnderCursor)
            }

            textBox.originCenter = textBox.getCenterPoint()
        })
        this.canvas.on('text:editing:exited', (e) => {
            const textBox = e.target
            if (textBox.maxWidth < textBox.width) {
                textBox.set('width', textBox.maxWidth + 10)
            }
            textBox.set({
                end: {
                    x: textBox.left + textBox.width,
                    y: textBox.top + textBox.height,
                },
            })
            textBox.originCenter = textBox.getCenterPoint()
        })
    }

    onMouseDown(o) {
        const pointer = this.canvas.getPointer(o.e)
        this.origX = pointer.x - 20
        this.origY = pointer.y - 30

        const textOpts = {
            left: this.origX,
            top: this.origY,
            fontSize: this.opts.textSize ? this.opts.textSize : this.textSize,
            fill: this.opts.color ? this.opts.color : this.color,
            stroke: this.opts.color ? this.opts.color : this.color,
            fontWeight: this.opts.textBold ? 'bold' : this.textBold,
            fontStyle: this.opts.textItalic ? 'italic' : this.textItalic,
            underline: this.opts.textUnderline
                ? this.opts.textUnderline
                : this.textUnderline,
            splitByGrapheme: true,
            objectCaching: false,
            lockScalingX: true,
            lockScalingY: true,
            lockUniScaling: true,
        }
        if (this.opts.textSpacing) {
            textOpts.textSpacing = this.opts.textSpacing
        }

        if (this.canvas.meta.color) {
            textOpts.stroke = this.canvas.meta.color
            textOpts.fill = this.canvas.meta.color
        }

        const rect = new fabric.LTextBox('', textOpts)

        const canvasWidth = this.canvas.width / this.canvas.getZoom()
        const maxWidth = canvasWidth - rect.left
        rect.set('width', maxWidth)

        rect.shapeType = this.shapeType
        rect.added = true

        rect.start = {
            x: rect.left,
            y: rect.top,
        }
        rect.end = {
            x: rect.left + rect.width,
            y: rect.top + rect.height,
        }

        rect.originLeft = rect.left
        rect.originTop = rect.top
        rect.originCenter = rect.getCenterPoint()

        let textStyle = {
            textSize: rect.fontSize,
            textBold: rect.fontWeight === '' ? false : rect.fontWeight,
            textItalic: rect.fontStyle === '' ? false : rect.fontStyle,
            textUnderline: rect.underline,
        }
        textStyle = new TextStyleModel(textStyle)
        rect.textStyle = textStyle
        this.canvas.add(rect).setActiveObject(rect)
        this.canvas.requestRenderAll()
        rect.enterEditing()
        rect.hiddenTextarea.focus()
    }
}

export default EditTextShape

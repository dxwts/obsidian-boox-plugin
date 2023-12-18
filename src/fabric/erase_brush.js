import { fabric } from 'fabric'

fabric.EraseBrush = fabric.util.createClass(fabric.PencilBrush, {
    type: 'EraseBrush',
    _finalizeAndAddPath: function () {
        const ctx = this.canvas.contextTop
        ctx.closePath()
        if (this.decimate) {
            this._points = this.decimatePoints(this._points, this.decimate)
        }
        const pathData = this.convertPointsToSVGPath(this._points).join('')
        if (pathData === 'M 0 0 Q 0 0 0 0 L 0 0') {
            this.canvas.requestRenderAll()
            return
        }

        const path = this.createPath(pathData)
        path.globalCompositeOperation = 'destination-out'
        path.absolutePositioned = true
        path.shapeType = 14

        this.canvas.clearContext(this.canvas.contextTop)
        this.canvas.fire('before:path:created', {
            path: path,
        })
        this.canvas.add(path)
        this.canvas.requestRenderAll()
        path.setCoords()
        this._resetShadow()

        this.canvas.fire('path:created', {
            path: path,
        })
    },
})

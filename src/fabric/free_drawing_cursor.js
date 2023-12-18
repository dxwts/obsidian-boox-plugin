import { fabric } from 'fabric'

fabric.FreeDrawingCursor = fabric.util.createClass(fabric.Circle, {
    type: 'freeDrawingCursor',

    initialize: function (_options) {
        //
        _options = _options || {}
        //
        this.callSuper(
            'initialize',
            fabric.util.object.extend(
                {
                    originX: 'center',
                    originY: 'center',
                    left: 0,
                    top: 0,
                    radius: 50,
                    fill: 'transparent',
                    stroke: 'black',
                },
                _options
            )
        )

        this.on('added', this.moveOffscreen)
    },

    moveTo: function (x, y) {
        this.canvas &&
            this.set({
                left: x,
                top: y,
            })
                .setCoords()
                .canvas.renderAll()

        return this
    },

    moveOffscreen: function () {
        const _offset = -this.radius * 2
        return this.moveTo(_offset, _offset)
    },
})

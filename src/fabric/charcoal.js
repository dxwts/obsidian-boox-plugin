import { fabric } from 'fabric'

const min = fabric.util.array.min
const max = fabric.util.array.max

fabric.Charcoal = fabric.util.createClass(fabric.Object, {
    type: 'Charcoal',
    points: null,

    initialize: function (points, options = {}) {
        this.callSuper('initialize', options)
        this.points = points
        this._setPositionDimensions(options)
    },

    _setPositionDimensions: function (options) {
        const calcDim = this._calcDimensions()
        let correctLeftTop
        this.width = calcDim.width
        this.height = calcDim.height
        if (!options.fromSVG) {
            correctLeftTop = this.translateToGivenOrigin(
                {
                    x: calcDim.left,
                    y: calcDim.top,
                },
                'left',
                'top',
                this.originX,
                this.originY
            )
        }
        if (typeof options.left === 'undefined') {
            this.left = options.fromSVG ? calcDim.left : correctLeftTop.x
        }
        if (typeof options.top === 'undefined') {
            this.top = options.fromSVG ? calcDim.top : correctLeftTop.y
        }
        this.pathOffset = {
            x: calcDim.left + this.width / 2,
            y: calcDim.top + this.height / 2,
        }
    },

    _calcDimensions: function () {
        const aX = []
        const aY = []
        for (const point of this.points) {
            aX.push(point.x)
            aX.push(point.x + point.width)
            aY.push(point.y)
            aY.push(point.y + point.height)
        }
        return {
            left: min(aX),
            top: min(aY),
            width: max(aX) - min(aX),
            height: max(aY) - min(aY),
        }
    },

    _render: function (ctx) {
        const tmpPoints = []
        for (const point of this.points) {
            const width = point.width
            const height = point.height
            const data = new Uint8Array(point.data)
            for (let y = 0; y < height; y++) {
                for (let x = 0; x < width; x++) {
                    const pos = (y * width + x) * 4
                    const r = data[pos]
                    const g = data[pos + 1]
                    const b = data[pos + 2]
                    const a = data[pos + 3]

                    const p = {
                        color:
                            'rgba(' +
                            r +
                            ',' +
                            g +
                            ',' +
                            b +
                            ',' +
                            a / 255 +
                            ')',
                        x: point.x + x - this.pathOffset.x,
                        y: point.y + y - this.pathOffset.y,
                        width: 1,
                        height: 1,
                    }
                    ctx.fillStyle = p.color
                    ctx.fillRect(p.x, p.y, p.width, p.height)
                    tmpPoints.push(p)
                }
            }
        }
        this.points = tmpPoints
    },
})

import { fabric } from 'fabric'

import { calculateTrapezoidPoints } from '../util'

const min = fabric.util.array.min
const max = fabric.util.array.max

fabric.Trapezoid = fabric.util.createClass(fabric.Polygon, {
    type: 'Trapezoid',
    points: null,
    start: null,
    end: null,
    originPoint: null,
    options: {
        originX: 'left',
        originY: 'top',
    },

    initialize: function (points, options = {}) {
        this.options = options
        this.start = points[0]
        this.end = points[1]
        this.points = calculateTrapezoidPoints(this.start, this.end)
        this.options = Object.assign(this.options, options)
        this.callSuper('initialize', this.points, this.options)
        this._setPositionDimensions(this.options)
    },

    _updatePoints() {
        this.points = calculateTrapezoidPoints(this.start, this.end)
        this._setPositionDimensions(this.options)
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
            aY.push(point.y)
        }
        return {
            left: this.start.x - this.width / 2,
            top: Math.min(this.start.y, this.end.y),
            width: max(aX) - min(aX),
            height: max(aY) - min(aY),
        }
    },
})

fabric.Trapezoid.fromObject = function (object, callback) {
    return fabric.Object._fromObject('Trapezoid', object, callback, 'points')
}

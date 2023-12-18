import { fabric } from 'fabric'

import { calculatePolygonPoints } from '../util'

const min = fabric.util.array.min
const max = fabric.util.array.max

fabric.Pentagon = fabric.util.createClass(fabric.Polygon, {
    type: 'Pentagon',
    points: null,
    start: null,
    end: null,
    originPoint: null,
    options: {
        originX: 'left',
        originY: 'top',
    },
    sideNum: 5,

    initialize: function (points, options = {}) {
        this.options = options
        this.start = points[0]
        this.end = points[1]
        this.points = calculatePolygonPoints(this.start, this.end, this.sideNum)
        this.options = Object.assign(this.options, options)
        this.callSuper('initialize', this.points, this.options)
        this._setPositionDimensions(this.options)
    },

    _updatePoints() {
        this.points = calculatePolygonPoints(this.start, this.end, this.sideNum)
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
            left: min(aX),
            top: min(aY),
            width: max(aX) - min(aX),
            height: max(aY) - min(aY),
        }
    },
})

fabric.Pentagon.fromObject = function (object, callback) {
    return fabric.Object._fromObject('Pentagon', object, callback, 'points')
}

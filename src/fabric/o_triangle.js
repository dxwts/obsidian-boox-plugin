import { fabric } from 'fabric'

import { calculateTrianglePoints } from '../util'

fabric.OTriangle = fabric.util.createClass(fabric.Polygon, {
    type: 'Triangle',
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
        this.points = calculateTrianglePoints(this.start, this.end)
        this.options = Object.assign(this.options, options)
        this.callSuper('initialize', this.points, this.options)
        this._setPositionDimensions(this.options)
        // this.left = this.start.x - this.width / 2
        // this.top = Math.min(this.start.y, this.end.y)
    },

    _updatePoints() {
        this.points = calculateTrianglePoints(this.start, this.end)
        this._setPositionDimensions(this.options)
        this.left = this.start.x - this.width / 2
        this.top = Math.min(this.start.y, this.end.y)
    },
})

fabric.OTriangle.fromObject = function (object, callback) {
    return fabric.Object._fromObject('OTriangle', object, callback, 'points')
}

import { fabric } from 'fabric'

const clone = fabric.util.object.clone

fabric.ArrowLine = fabric.util.createClass(fabric.Path, {
    type: 'ArrowLine',
    points: null,
    start: null,
    end: null,
    originPoint: null,
    options: {
        strokeWidth: 1,
    },
    pathStr: null,

    initialize: function (points, options = {}) {
        this.options = options
        this.points = points
        this.start = points[0]
        this.end = points[1]
        this.originPoint = new fabric.Point(this.start.x, this.start.y)
        this._calcArrow()
        this.callSuper('initialize', this.pathStr, options)
    },

    _calcArrow() {
        const arrowLenFactor = 6.0
        const arrowHeight = 8
        const halfBottomLine = 5.5

        const arrowLen = this.options.strokeWidth * arrowLenFactor
        const arrowRad = Math.atan(halfBottomLine / arrowHeight)
        const arrPoint1 = this._rotateVector(
            { x: this.end.x - this.start.x, y: this.end.y - this.start.y },
            arrowRad,
            arrowLen
        )
        const arrPoint2 = this._rotateVector(
            { x: this.end.x - this.start.x, y: this.end.y - this.start.y },
            -arrowRad,
            arrowLen
        )
        const lineData = `M ${this.start.x} ${this.start.y} L ${this.end.x} ${
            this.end.y
        } M ${this.end.x} ${this.end.y} L ${this.end.x - arrPoint1.x} ${
            this.end.y - arrPoint1.y
        } M ${this.end.x} ${this.end.y} L ${this.end.x - arrPoint2.x} ${
            this.end.y - arrPoint2.y
        }`
        this.pathStr = lineData
    },

    _rotateVector(point, angle, arrowLen) {
        let vx = point.x * Math.cos(angle) - point.y * Math.sin(angle)
        let vy = point.x * Math.sin(angle) + point.y * Math.cos(angle)
        const d = Math.sqrt(vx * vx + vy * vy)
        vx = (vx / d) * arrowLen
        vy = (vy / d) * arrowLen
        return {
            x: vx,
            y: vy,
        }
    },

    _updatePath() {
        this._calcArrow()
        this.path = fabric.util.makePathSimpler(
            fabric.util.parsePath(this.pathStr)
        )
        this._setPositionDimensions()
    },

    _setPositionDimensions() {
        this.options = this.options || {}
        fabric.Polyline.prototype._setPositionDimensions.call(
            this,
            this.options
        )
    },
})

fabric.ArrowLine.fromObject = function (object, callback) {
    function _callback(instance) {
        delete instance.points
        callback && callback(instance)
    }
    const options = clone(object, true)
    options.points = object.shapeData
    fabric.Object._fromObject('ArrowLine', options, _callback, 'points')
}

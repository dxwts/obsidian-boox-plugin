import { fabric } from 'fabric'

import { distance } from 'src/util'

const clone = fabric.util.object.clone

fabric.Wavy = fabric.util.createClass(fabric.Path, {
    type: 'Wavy',
    points: null,
    waveLength: 24,
    wavePeak: 12,
    pathStr: null,
    angle: 0,
    start: null,
    end: null,
    originPoint: null,

    initialize: function (points, options = {}) {
        this.points = points
        this.start = this.points[0]
        this.end = this.points[1]
        this.originPoint = new fabric.Point(this.start.x, this.start.y)
        this._calcAngle()
        this._calcPath()
        this._updatePath()
        this.callSuper('initialize', this.path, options)
    },

    _calcPath() {
        const waveLength = 24
        const wavePeak = 12
        let lineData = `M ${this.start.x} ${this.start.y}`
        const width = distance(
            this.end.x,
            this.end.y,
            this.start.x,
            this.start.y
        )
        const waveCount = width / waveLength

        let tmpPoint = Object.assign({}, this.start)
        for (let i = 0; i < waveCount; i++) {
            let cPoint = {
                x: tmpPoint.x + waveLength / 4,
                y: tmpPoint.y - wavePeak,
            }
            let toPoint = {
                x: tmpPoint.x + waveLength / 2,
                y: tmpPoint.y,
            }
            tmpPoint = Object.assign({}, toPoint)
            cPoint = this._rotatePoint(cPoint)
            toPoint = this._rotatePoint(toPoint)
            lineData = `${lineData} Q ${cPoint.x} ${cPoint.y} ${toPoint.x} ${toPoint.y}`

            cPoint = {
                x: tmpPoint.x + waveLength / 4,
                y: tmpPoint.y + wavePeak,
            }
            toPoint = {
                x: tmpPoint.x + waveLength / 2,
                y: tmpPoint.y,
            }
            tmpPoint = Object.assign({}, toPoint)
            cPoint = this._rotatePoint(cPoint)
            toPoint = this._rotatePoint(toPoint)
            lineData = `${lineData} Q ${cPoint.x} ${cPoint.y} ${toPoint.x} ${toPoint.y}`
        }
        this.pathStr = lineData
    },

    _calcAngle() {
        this.angle = Math.atan2(
            this.end.y - this.start.y,
            this.end.x - this.start.x
        )
    },

    _rotatePoint(point) {
        return fabric.util.rotatePoint(
            new fabric.Point(point.x, point.y),
            this.originPoint,
            this.angle
        )
    },

    _updatePath() {
        this.path = fabric.util.makePathSimpler(
            fabric.util.parsePath(this.pathStr)
        )
    },

    _setPositionDimensions() {
        this.options = this.options || {}
        fabric.Polyline.prototype._setPositionDimensions.call(
            this,
            this.options
        )
    },
})

fabric.Wavy.fromObject = function (object, callback) {
    function _callback(instance) {
        delete instance.points
        callback && callback(instance)
    }
    const options = clone(object, true)
    options.points = object.shapeData
    fabric.Object._fromObject('Wavy', options, _callback, 'points')
}

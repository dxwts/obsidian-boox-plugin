import { fabric } from 'fabric'

const str = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="20px" height="20px" viewBox="0 0 20 20" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <!-- Generator: Sketch 53.2 (72643) - https://sketchapp.com -->
    <title>录音</title>
    <desc>Created with Sketch.</desc>
    <g id="录音" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
        <g id="luyin" transform="translate(5.000000, 2.500000)" fill="#505F79" fill-rule="nonzero">
            <path d="M9.37500001,6.875 C9.72017798,6.875 10,7.15482203 10,7.5 C10,9.75125 8.076875,11.573125 5.62500001,11.84125 L5.62500001,13.75 L7.8125,13.75 C7.98508898,13.75 8.125,13.889911 8.125,14.0625 L8.125,14.6875 C8.125,14.860089 7.98508898,15 7.8125,15 L2.1875,15 C2.01491102,15 1.875,14.860089 1.875,14.6875 L1.875,14.0625 C1.875,13.889911 2.01491102,13.75 2.1875,13.75 L4.37499999,13.75 L4.37499999,11.84125 C1.923125,11.57375 0,9.75125 0,7.5 C5.28386477e-05,7.1548594 0.279859393,6.87509568 0.624999998,6.87509568 C0.970140604,6.87509568 1.24994716,7.1548594 1.25,7.5 C1.25,9.2025 2.909375,10.625 5,10.625 C7.090625,10.625 8.75,9.2025 8.75,7.5 C8.75,7.15482203 9.02982204,6.875 9.37500001,6.875 Z M5,0 C6.72588984,1.05680273e-16 8.125,1.39911015 8.125,3.125 L8.125,6.875 C8.12499997,8.60088982 6.72588982,9.99999994 5,9.99999994 C3.27411018,9.99999994 1.87500003,8.60088982 1.875,6.875 L1.875,3.125 C1.875,1.39911015 3.27411016,3.1704082e-16 5,0 Z M5,1.25 C4.00715149,1.24994469 3.1863721,2.02386154 3.12812499,3.015 L3.125,3.125 L3.125,6.875 C3.12402194,7.88980914 3.93060439,8.72121986 4.94497696,8.7509996 C5.95934953,8.78077935 6.81331756,7.99811874 6.87187501,6.985 L6.875,6.875 L6.875,3.125 C6.875,2.08946609 6.03553391,1.25 5,1.25 Z" id="Shape"></path>
        </g>
    </g>
</svg>`

class AudioShape {
    origX = 0
    origY = 0
    bHeight = 80
    bLeft = 40
    bTop = 120
    constructor(canvas, opts = {}) {
        this.opts = opts
        this.canvas = canvas
        this.className = 'Audio'
        this.shapeType = 23
        this.opts.resource.type = 2
        this.render()
    }

    render() {
        fabric.loadSVGFromString(str, (obj, options) => {
            const svg = fabric.util.groupSVGElements(obj, options)
            svg.scaleToHeight(this.bHeight * 0.8)

            const titleShape = new fabric.Text(this.opts.resource.title, {
                left: svg.getScaledWidth() + 5,
                fontSize: 32,
            })
            titleShape.top = (this.bHeight - titleShape.getScaledHeight()) / 2
            const group = new fabric.Group([svg, titleShape], {
                left: this.bLeft,
                top: this.bTop,
            })

            // group.on('mousedblclick', async e => {
            //   if (!group.audio) {
            //     const url = await getResourceUrl(this.opts.resource.ossUrl)
            //     group.audio = new Audio(url)
            //   }
            //   if (group.audio.paused) {
            //     group.audio.play()
            //   } else {
            //     group.audio.pause()
            //   }
            // })
            group.added = true
            group.shapeType = this.shapeType
            group.resource = this.opts.resource
            group.start = {
                x: group.left,
                y: group.top,
            }
            group.end = {
                x: group.left + 70,
                y: group.top + 70,
            }
            group.originLeft = group.left
            group.originTop = group.top
            group.originCenter = group.getCenterPoint()
            this.canvas.add(group).setActiveObject(group)
            this.canvas.renderAll()
        })
    }

    static create(shape) {
        return new Promise((resolve) => {
            const rect = shape.meta.boundingRect
            const width = rect.right - rect.left
            const height = rect.bottom - rect.top
            fabric.loadSVGFromString(str, (obj, options) => {
                const svg = fabric.util.groupSVGElements(obj, options)
                svg.scaleToHeight(height * 0.8)

                const titleShape = new fabric.Text(shape.meta.resource.title, {
                    left: svg.getScaledWidth() + 5,
                })
                titleShape.scaleToWidth(width - svg.getScaledWidth() - 5)
                titleShape.top = (height - titleShape.getScaledHeight()) / 2
                const group = new fabric.Group([svg, titleShape], {
                    left: rect.left,
                    top: rect.top,
                    width: width,
                    height: height,
                    id: shape._id,
                })
                group.shape = shape.meta
                resolve(group)
            })
        })
    }
}

export default AudioShape

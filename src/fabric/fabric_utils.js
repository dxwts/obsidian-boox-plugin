import { fabric } from 'fabric'

import 'src/fabric/arrow_line'
import 'src/fabric/charcoal'
import 'src/fabric/free_drawing_cursor'
import 'src/fabric/hexagon'
import 'src/fabric/l_text_box'
import 'src/fabric/o_triangle'
import 'src/fabric/pentagon'
import 'src/fabric/trapezoid'
import 'src/fabric/wavy'
import 'src/fabric/erase_brush'

fabric.Object.prototype.cornerColor = '#4285F4'
fabric.Object.prototype.cornerSize = 6
// fabric.Object.prototype.cornerStyle = 'circle'
fabric.Object.prototype.objectCaching = false

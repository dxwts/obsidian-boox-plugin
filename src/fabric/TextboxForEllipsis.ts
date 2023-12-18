import { fabric } from "fabric";


export default class TextboxForEllipsis extends fabric.Textbox {
	[x: string]: any
	constructor(text: string, options: fabric.TextboxOptions) {
	  super(text, options)
	}
	_wrapLine(_line: any, lineIndex: any, desiredWidth: any, reservedSpace: any) {
	  const offset = 0
	  let textWidth = this._measureWord(_line, lineIndex, offset)
  
	  if (textWidth > desiredWidth && !this.isEditing) {
		let left = _line.substring(0, Math.floor(_line.length / 2)) // 获取字符串左半部分
		let right = _line.substring(Math.floor(_line.length / 2)) // 获取字符串右半部分
		while (textWidth >= desiredWidth) {
		  if (left.length > right.length) {
			// 左侧字符串比右侧字符串长
			left = left.slice(0, -1) // 删除左侧字符串最后一个字符
		  } else if (right.length > left.length) {
			// 右侧字符串比左侧字符串长
			right = right.slice(1) // 删除右侧字符串第一个字符
		  } else {
			// 左右字符串长度相同
			left = left.slice(0, -1) // 优先删除左侧字符串中的一个字符
		  }
		  _line = left + '…' + right
		  textWidth = this._measureWord(_line, lineIndex, offset)
		}
	  }
  
	  return super._wrapLine(_line, lineIndex, desiredWidth, reservedSpace)
	}
  }
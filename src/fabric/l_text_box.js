import { fabric } from 'fabric'

fabric.LTextBox = fabric.util.createClass(fabric.Textbox, {
    maxWidth: 0,
    onInput: function (e) {
        this.callSuper('onInput', e)
    },
})

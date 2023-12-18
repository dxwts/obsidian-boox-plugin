export const loadPdfJs = () => {
    return new Promise((resolve, reject) => {
        if (window.pdfjsLib) {
            resolve(window.pdfjsLib)
        } else {
            const script = document.createElement('script')
            script.src =
                'https://static-us-volc.boox.com/libs/pdf.js/3.9.179/pdf.min.js'
            script.onload = () => {
                resolve(window.pdfjsLib)
            }
            script.onerror = () => {
                reject(new Error('Failed to load PDF.js'))
            }
            document.body.appendChild(script)
        }
    })
}

export const loadPdf = async (url, pageNum) => {
    const pdfjsLib = await loadPdfJs()
    const loadingTask = pdfjsLib.getDocument(url)
    const pdf = await loadingTask.promise
    const page = await pdf.getPage(pageNum)
    return { pdf, page }
}

export const pdfToPng = async (pdfUrl, pageNum) => {
    const { page } = await loadPdf(pdfUrl, pageNum)
    const canvas = document.createElement('canvas')
    const viewport = page.getViewport({ scale: 1 })
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')
    const renderContext = {
        canvasContext: ctx,
        viewport,
    }
    await page.render(renderContext).promise
    return canvas.toDataURL('image/png')
}

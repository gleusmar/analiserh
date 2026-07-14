const pdfjsLib = require('pdfjs-dist/legacy/build/pdf.js')
const fs = require('fs')
;(async () => {
  const data = new Uint8Array(fs.readFileSync('src/assets/139746.pdf'))
  const pdf = await pdfjsLib.getDocument({ data }).promise
  const out = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const text = await page.getTextContent()
    for (const item of text.items) {
      if (item.str && item.str.trim()) {
        out.push(JSON.stringify({ page: i, text: item.str, transform: item.transform }))
      }
    }
  }
  fs.writeFileSync('/tmp/139746-pdf-words.txt', out.join('\n'))
})()

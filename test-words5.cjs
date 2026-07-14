const { createWorker } = require('tesseract.js');
const toLines = (words, yTol = 15, xSpace = 2) => {
  const rows = []
  for (const w of words) {
    const y = Math.round((w.bbox.y0 + w.bbox.y1) / 2)
    let row = rows.find(r => Math.abs(r.y - y) <= yTol)
    if (!row) { row = { y, words: [] }; rows.push(row) }
    row.words.push({ text: w.text, x0: w.bbox.x0, x1: w.bbox.x1 })
  }
  rows.sort((a, b) => a.y - b.y)
  for (const row of rows) row.words.sort((a, b) => a.x0 - b.x0)
  return rows.map(row => {
    let line = '', lastX1 = null
    for (const w of row.words) {
      if (lastX1 !== null && w.x0 - lastX1 > xSpace) line += ' '
      line += w.text
      lastX1 = w.x1
    }
    return line
  }).join('\n')
}
(async () => {
  const worker = await createWorker('por', 1, { logger: m => {} });
  await worker.setParameters({ tessedit_pageseg_mode: '3' });
  const { data } = await worker.recognize('/tmp/139746/p2-300-2-rot.png');
  const text = toLines(data.words)
  const idx = text.indexOf('LIPIDOGRAMA')
  console.log(text.slice(idx - 100, idx + 500))
  await worker.terminate()
})()

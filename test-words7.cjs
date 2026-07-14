const { createWorker } = require('tesseract.js');
const toLines = (words, yTol = 15) => {
  const rows = []
  for (const w of words) {
    if (!w.text.trim()) continue
    const y = Math.round((w.bbox.y0 + w.bbox.y1) / 2)
    let row = rows.find(r => Math.abs(r.y - y) <= yTol)
    if (!row) { row = { y, words: [] }; rows.push(row) }
    row.words.push({ text: w.text, x0: w.bbox.x0, x1: w.bbox.x1 })
  }
  rows.sort((a, b) => a.y - b.y)
  for (const row of rows) row.words.sort((a, b) => a.x0 - b.x0)
  return rows.map(row => row.words.map(w => w.text).join(' ')).join('\n')
}
(async () => {
  const worker = await createWorker('por', 1, { logger: m => {} });
  await worker.setParameters({ tessedit_pageseg_mode: '3' });
  const { data } = await worker.recognize('/tmp/139746/p2-300-2-rot.png');
  console.log('data.text around LIPIDOGRAMA:')
  const idx = data.text.indexOf('LIPIDOGRAMA')
  console.log(data.text.slice(idx - 200, idx + 400))
  console.log('--- words around LIPIDOGRAMA exec ---')
  for (const w of data.words) {
    if (w.bbox.y0 >= 1500 && w.bbox.y0 <= 1530 && w.bbox.x0 >= 1200) {
      console.log(JSON.stringify({ t: w.text, x: w.bbox.x0, y: w.bbox.y0, x1: w.bbox.x1 }))
    }
  }
  console.log('--- toLines around LIPIDOGRAMA ---')
  const text = toLines(data.words)
  const idx2 = text.indexOf('LIPIDOGRAMA')
  console.log(text.slice(idx2 - 100, idx2 + 300))
  await worker.terminate()
})()

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
  const text = toLines(data.words)
  const lines = text.split('\n')
  for (const line of lines) {
    if (/LIPIDOGRAMA|40302750|UREIA|VITAMINA D|HEMOGRAMA|URINA/.test(line)) console.log(line)
  }
  console.log("TEXT SNIP", text.slice(1200,1700)); await worker.terminate()
})()

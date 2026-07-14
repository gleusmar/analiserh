const fs = require('fs')
const pdfjs = require('pdfjs-dist')
const data = fs.readFileSync('src/assets/139746.pdf')
const toDegrees = (rad) => Math.round((rad * 180) / Math.PI)
const detectTextRotation = (items) => {
  const angles = []
  for (const item of items) {
    if (!item.str || !item.str.trim()) continue
    const tx = item.transform || []
    const a = Number(tx[0] || 0)
    const b = Number(tx[1] || 0)
    if (a === 0 && b === 0) continue
    const angle = toDegrees(Math.atan2(b, a))
    angles.push(angle)
  }
  if (angles.length === 0) return 0
  const rounded = angles.map(a => {
    if (Math.abs(a) <= 15) return 0
    if (Math.abs(a - 90) <= 15) return 90
    if (Math.abs(a + 90) <= 15) return -90
    if (Math.abs(a - 180) <= 15 || Math.abs(a + 180) <= 15) return 180
    return a
  })
  const counts = {}
  for (const a of rounded) { counts[a] = (counts[a] || 0) + 1 }
  let dominant = 0, max = 0
  for (const [a, count] of Object.entries(counts)) { if (count > max) { max = count; dominant = Number(a) } }
  return dominant
}
;(async () => {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(data) }).promise
  const pageTexts = []
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i)
    const textContent = await page.getTextContent()
    const items = textContent.items.filter(item => item && typeof item.str === 'string' && item.str.trim())
    console.log('page', i, 'rotation', detectTextRotation(items))
    const rows = []
    const tolerance = 3
    for (const item of items) {
      let row = rows.find(r => Math.abs(r.y - item.transform[5]) <= tolerance)
      if (!row) { row = { y: item.transform[5], items: [] }; rows.push(row) }
      row.items.push(item)
    }
    rows.sort((a,b) => a.y - b.y)
    for (const row of rows) row.items.sort((a,b) => a.transform[4] - b.transform[4])
    const lines = rows.map(row => row.items.map(i => i.str).join(' '))
    pageTexts.push(lines.join('\n'))
  }
  const fullText = pageTexts.join('\f')
  console.log('--- page 1 ---')
  console.log(fullText.split('\f')[0].slice(0, 2000))
  console.log('--- page 2 ---')
  console.log(fullText.split('\f')[1].slice(0, 2000))
})()

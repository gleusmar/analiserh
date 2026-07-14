const { createWorker } = require('tesseract.js');
(async () => {
  const worker = await createWorker('por', 1, { logger: m => {} });
  await worker.setParameters({ tessedit_pageseg_mode: '3' });
  const { data } = await worker.recognize('/tmp/139746/p2-300-2-rot.png');
  const keywords = ['LIPIDOGRAMA', 'UREIA', 'CREATININA', '21.61', '4.32', '5.56', '30.43', '8.89', '2', '1.61']
  for (const w of data.words) {
    if (keywords.some(k => w.text.includes(k))) {
      console.log(JSON.stringify({ t: w.text, bbox: w.bbox }))
    }
  }
  await worker.terminate()
})()

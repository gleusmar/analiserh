const { createWorker } = require('tesseract.js');
(async () => {
  const worker = await createWorker('por', 1, { logger: m => {} });
  await worker.setParameters({ tessedit_pageseg_mode: '3' });
  const { data } = await worker.recognize('/tmp/139746/p2-300-2-rot.png');
  for (const w of data.words) {
    if (w.bbox.y0 >= 1500 && w.bbox.y0 <= 1530 && w.bbox.x0 >= 1250 && w.bbox.x0 <= 3150) {
      console.log(JSON.stringify({ t: w.text, x: w.bbox.x0, y: w.bbox.y0, x1: w.bbox.x1, w: w.bbox.x1 - w.bbox.x0 }))
    }
  }
  await worker.terminate()
})()

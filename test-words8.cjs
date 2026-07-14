const { createWorker } = require('tesseract.js');
(async () => {
  const worker = await createWorker('por', 1, { logger: m => {} });
  await worker.setParameters({ tessedit_pageseg_mode: '3' });
  const { data } = await worker.recognize('/tmp/139746/p2-300-2-rot.png');
  for (const w of data.words) {
    if (w.bbox.y0 >= 1500 && w.bbox.y0 <= 1530 && w.bbox.x0 >= 1200) {
      console.log(w.text, w.bbox.x0, w.bbox.y0, w.bbox.x1)
    }
  }
  await worker.terminate()
})()

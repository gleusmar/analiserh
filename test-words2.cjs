const { createWorker } = require('tesseract.js');
(async () => {
  const worker = await createWorker('por', 1, { logger: m => {} });
  await worker.setParameters({ tessedit_pageseg_mode: '3' });
  const { data } = await worker.recognize('/tmp/139746/p2-300-2-rot.png');
  for (const w of data.words) {
    if (/LIPIDOGRAMA|21\.61|^2$|^1\.61$|UREIA|4\.32|8\.89|30\.43|5\.56/.test(w.text)) {
      console.log(w.text, w.bbox)
    }
  }
  await worker.terminate()
})()

const { createWorker } = require('tesseract.js');
const path = require('path');
(async () => {
  const worker = await createWorker('por', 1, {
    logger: m => console.log(m.status, m.progress),
    errorHandler: e => console.error('error', e)
  });
  await worker.setParameters({
    tessedit_pageseg_mode: '3',
  });
  const { data: { text } } = await worker.recognize('/tmp/139746/page-1.png');
  console.log('--- OCR TEXT ---');
  console.log(text);
  await worker.terminate();
})();

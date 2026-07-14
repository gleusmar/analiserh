const { createWorker } = require('tesseract.js');
const fs = require('fs');
(async () => {
  const files = ['/tmp/139746/page-1.png', '/tmp/139746/page-1-rot90.png', '/tmp/139746/page-1-rot-90.png'];
  const worker = await createWorker('por', 1, { logger: m => {} });
  await worker.setParameters({ tessedit_pageseg_mode: '3' });
  for (const f of files) {
    const { data: { text } } = await worker.recognize(f);
    console.log(`--- ${f} ---`);
    console.log(text.slice(0, 2000));
  }
  await worker.terminate();
})();

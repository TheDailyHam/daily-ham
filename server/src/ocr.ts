// Slip Check photo OCR — runs on the server, never on the phone.
//
// The first version read photos in the browser with tesseract.js loaded
// from a CDN: a multi-file chain (worker script + wasm core + 4MB
// language data) that stalled silently in the installed app on the
// owner's phone — the picture displayed and nothing ever happened.
// Here the language data ships in the repo (server/assets), the wasm
// core comes from the installed npm package, and the phone does one
// ordinary API call. The image is recognized in memory and never
// stored anywhere.
//
// One worker is kept warm and jobs are serialized through a promise
// chain: OCR is CPU-heavy and a free-tier instance should never run
// two at once.
import { createWorker } from "tesseract.js";
import { fileURLToPath } from "node:url";

const LANG_DIR = fileURLToPath(new URL("../assets/", import.meta.url));

type OcrWorker = Awaited<ReturnType<typeof createWorker>>;
let workerPromise: Promise<OcrWorker> | null = null;
let chain: Promise<unknown> = Promise.resolve();

function getWorker(): Promise<OcrWorker> {
  if (!workerPromise) {
    workerPromise = createWorker("eng", undefined, {
      langPath: LANG_DIR,
      gzip: false,
      cacheMethod: "none",
    }).catch((err: unknown) => {
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

export async function recognizeSlipText(image: Buffer): Promise<string> {
  const job = chain.then(async () => {
    const worker = await getWorker();
    const { data } = await worker.recognize(image);
    return data.text;
  });
  // A failed job must not poison the queue for the next photo.
  chain = job.catch(() => {});
  return job;
}

import { env, pipeline, RawImage } from '@huggingface/transformers';

// Configure transformers.js for browser WASM/WebGPU without requiring local model files
env.allowLocalModels = false;
env.useBrowserCache = true;

type ExtractorFn = (
  input: RawImage,
  options?: { pooling?: string; normalize?: boolean }
) => Promise<{ data: Float32Array | number[] }>;

let extractorPromise: Promise<ExtractorFn | null> | null = null;
let modelDisabled = false;

async function getExtractor(): Promise<ExtractorFn | null> {
  if (modelDisabled) return null;
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const candidates = ['Xenova/clip-vit-base-patch32', 'Xenova/vit-base-patch16-224-in21k'];
      for (const modelId of candidates) {
        try {
          const pipe = await pipeline('image-feature-extraction', modelId, {
            dtype: 'q8',
          });
          return pipe as unknown as ExtractorFn;
        } catch (err) {
          console.warn(`Transformers.js model ${modelId} unavailable:`, err);
        }
      }
      modelDisabled = true;
      return null;
    })();
  }
  return extractorPromise;
}

self.onmessage = async (
  event: MessageEvent<{ id: string; type: 'warmup' | 'embed'; imageDataUrl?: string }>
) => {
  const { id, type, imageDataUrl } = event.data;

  if (type === 'warmup') {
    const ext = await getExtractor();
    self.postMessage({ id, ready: Boolean(ext) });
    return;
  }

  if (type === 'embed' && imageDataUrl) {
    try {
      const ext = await getExtractor();
      if (!ext) {
        self.postMessage({ id, embedding: null });
        return;
      }
      const rawImg = await RawImage.fromURL(imageDataUrl);
      const output = await ext(rawImg, { pooling: 'mean', normalize: true });
      const vec = Array.from(output.data, (v) => Number(v.toFixed(5)));
      self.postMessage({ id, embedding: vec });
    } catch {
      self.postMessage({ id, embedding: null });
    }
  }
};

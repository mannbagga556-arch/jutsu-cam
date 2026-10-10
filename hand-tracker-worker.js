importScripts('./vendor/tasks-vision/vision_bundle.js');

const { FilesetResolver, HandLandmarker } = Vision;
let handLandmarker;

self.addEventListener('message', async ({ data }) => {
  if (data.type === 'init') {
    try {
      const wasmPath = new URL('./vendor/tasks-vision/wasm/', self.location.href).href;
      const modelPath = new URL('./models/hand_landmarker.task', self.location.href).href;
      const vision = await FilesetResolver.forVisionTasks(wasmPath);
      const options = {
        baseOptions: { modelAssetPath: modelPath, delegate: 'GPU' },
        runningMode: 'VIDEO',
        numHands: 2
      };
      try {
        handLandmarker = await HandLandmarker.createFromOptions(vision, options);
        self.postMessage({ type: 'ready', delegate: 'GPU' });
      } catch (gpuError) {
        // GPU delegates are not available in every browser/driver combination.
        // Fall back to CPU so the app still starts without additional downloads.
        handLandmarker = await HandLandmarker.createFromOptions(vision, {
          ...options,
          baseOptions: { modelAssetPath: modelPath, delegate: 'CPU' }
        });
        self.postMessage({ type: 'ready', delegate: 'CPU', gpuFallback: true });
      }
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message || String(error) });
    }
    return;
  }

  if (data.type === 'frame' && handLandmarker) {
    const { bitmap } = data;
    try {
      const startedAt = performance.now();
      const result = handLandmarker.detectForVideo(bitmap, performance.now());
      const inferenceMs = performance.now() - startedAt;
      self.postMessage({ type: 'result', landmarks: result.landmarks, inferenceMs });
    } catch (error) {
      self.postMessage({ type: 'error', message: error.message || String(error) });
    } finally {
      bitmap.close();
    }
  }
});

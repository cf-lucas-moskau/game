// Performance budgets from the spec. The benchmark gate compares against these.
export const BUDGETS = {
  frameP95Ms: 16.7, frameP99Ms: 20, onePercentLowFps: 55,
  simTickP95Ms: 2, renderCpuP95Ms: 6, renderUpdateP95Ms: 3, renderSubmitP95Ms: 4,
  inputLatencyP95Ms: 16.7 + 20 + 100, // + one-way network at the 100 ms-RTT scenario (prediction hides it visually)
  gcPauseMaxMs: 5, heapGrowthMbPer10Min: 5,
  drawCallsMax: 50, loadMs: 4000, fileBytes: 2 * 1024 * 1024 * 8, // file budget raised: 3D assets inlined (see docs/PERF.md)
  correctionsPer10s: 1,
};
// CPU-side metrics are reliable in the headless container (software GPU); these gate merges.
// With a software GPU (SwiftShader, as in CI containers) GL submission competes with rasterization
// for the same cores, so only JS-side metrics gate; on a real GPU the full render CPU gates too.
export const GATED = ['simTickP95Ms', 'renderUpdateP95Ms', 'gcPauseMaxMs', 'heapGrowthMbPer10Min', 'drawCallsMax', 'loadMs', 'correctionsPer10s'];
// input latency includes waiting for the next frame, so it is only meaningful where frames are real
export const GATED_REAL_GPU = [...GATED, 'renderCpuP95Ms', 'renderSubmitP95Ms', 'frameP95Ms', 'frameP99Ms', 'inputLatencyP95Ms'];
export const REGRESSION_TOLERANCE = 0.10;

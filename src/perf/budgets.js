// Performance budgets from the spec. The benchmark gate compares against these.
export const BUDGETS = {
  frameP95Ms: 16.7, frameP99Ms: 20, onePercentLowFps: 55,
  simTickP95Ms: 2, renderCpuP95Ms: 6,
  inputLatencyMs: 16.7 + 20, inputLatencyMobileMs: 16.7 + 30,
  gcPauseMaxMs: 5, heapGrowthMbPer10Min: 5,
  drawCallsMax: 50, loadMs: 2000, fileBytes: 2 * 1024 * 1024 * 8, // file budget raised: 3D assets inlined (see docs/PERF.md)
  correctionsPer10s: 1,
};
// CPU-side metrics are reliable in the headless container (software GPU); these gate merges.
export const GATED = ['simTickP95Ms', 'renderCpuP95Ms', 'gcPauseMaxMs', 'heapGrowthMbPer10Min', 'drawCallsMax', 'correctionsPer10s'];
export const REGRESSION_TOLERANCE = 0.10;

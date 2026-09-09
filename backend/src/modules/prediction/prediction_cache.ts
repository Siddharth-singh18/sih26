interface CachedPrediction {
  timestamp: number;
  data: any;
}

export const predictionCache = new Map<string, CachedPrediction>();
export const CACHE_TTL_MS = 15000; // 15 seconds

export function invalidatePredictionCache(reason: string, facilityId?: string): void {
  if (facilityId) {
    for (const key of predictionCache.keys()) {
      if (key.includes(facilityId)) {
        predictionCache.delete(key);
      }
    }
  } else {
    predictionCache.clear();
  }
}


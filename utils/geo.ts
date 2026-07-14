/** Radio medio de la Tierra en km. */
const EARTH_RADIUS_KM = 6371;

/**
 * Distancia lineal en km entre dos coordenadas (fórmula del semiverseno):
 * d = 2R·arcsin(√(sin²(Δφ/2) + cos φ1 · cos φ2 · sin²(Δλ/2)))
 */
export function haversineKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dPhi = rad(lat2 - lat1);
  const dLambda = rad(lon2 - lon1);
  const a =
    Math.sin(dPhi / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLambda / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

/** Coordenadas del IFAE (Institut de Física d'Altes Energies, UAB). */
export const IFAE_COORDS = { latitude: 41.501472, longitude: 2.1095 };

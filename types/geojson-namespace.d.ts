/**
 * Ambient GeoJSON types for map.tsx.
 * pnpm does not hoist @types/geojson from maplibre-gl, so Next typecheck
 * cannot see the GeoJSON namespace without this shim or a direct dep.
 */
declare namespace GeoJSON {
  type GeoJsonProperties = { [name: string]: any } | null

  interface Geometry {
    type: string
    coordinates: any
  }

  interface Point {
    type: "Point"
    coordinates: [number, number] | [number, number, number]
  }

  interface Feature<G extends Geometry | null = Geometry, P = GeoJsonProperties> {
    type: "Feature"
    geometry: G
    properties: P
    id?: string | number
  }

  interface FeatureCollection<G extends Geometry | null = Geometry, P = GeoJsonProperties> {
    type: "FeatureCollection"
    features: Array<Feature<G, P>>
  }
}

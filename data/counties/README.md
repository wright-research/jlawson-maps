# County GeoJSON Files

This directory should contain individual GeoJSON files for each Georgia county.

## Required Files

Place the following GeoJSON files in this directory:

- `Hall.geojson`
- `Habersham.geojson`
- `White.geojson`
- `Jackson.geojson`
- `Forsyth.geojson`
- `Barrow.geojson`
- `Stephens.geojson`
- `Gwinnett.geojson`

## File Format

Each file should be a valid GeoJSON file containing the county boundary geometry. The file can be either:

1. A FeatureCollection:
```json
{
  "type": "FeatureCollection",
  "features": [
    {
      "type": "Feature",
      "geometry": { ... },
      "properties": { ... }
    }
  ]
}
```

2. A single Feature:
```json
{
  "type": "Feature",
  "geometry": { ... },
  "properties": { ... }
}
```

## Where to Get County Boundaries

You can download Georgia county boundaries from:

- **Census Bureau TIGER/Line Shapefiles**: https://www.census.gov/geographies/mapping-files/time-series/geo/tiger-line-file.html
  - Select year → Counties → Georgia → Download
  - Convert to GeoJSON using tools like `ogr2ogr` or QGIS

- **Georgia GIS Clearinghouse**: https://data.georgiaspatial.org/

- **ArcGIS Hub**: Search for "Georgia counties"

## Converting Shapefiles to GeoJSON

If you have shapefiles, convert them to GeoJSON:

```bash
# Using ogr2ogr (from GDAL)
ogr2ogr -f GeoJSON Hall.geojson counties.shp -where "NAME='Hall'"
```

Or use online converters like https://mapshaper.org/

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Appraisal mapping tool for J. Lawson & Associates. Users create, save, and manage maps with typed pins (subject, sales, rent, land comps) for real estate appraisals. Data is persisted in Supabase; maps are rendered with Mapbox GL JS.

## Stack

- **No build step** — vanilla JS/HTML served as static files, all dependencies via CDN script tags
- Mapbox GL JS v3.0.1 (map rendering, geocoder plugin)
- Supabase JS v2.39.3 (database CRUD)
- Web Awesome (UI components: `wa-dialog`, `wa-switch`, `wa-radio-group`, `wa-button`, `wa-input`, `wa-textarea`, `wa-icon`)
- html2canvas v1.4.1 (image export)
- Turf.js v6 (geodetic distance calculations for measure tool)
- SweetAlert2 (unused legacy — dialogs now use Web Awesome `wa-dialog`)

## Development

Open `index.html` directly in a browser or serve with any static file server. No install, build, or test commands. To test, open the app and interact manually.

## Architecture

### Script load order (matters — no modules)

`config.js` → `counties-data.js` → `supabase.js` → `map.js` → `app.js`

All scripts share the global scope. Functions in `map.js` are called by `app.js`, and `map.js` calls back into `app.js` via `typeof` guards (e.g., `if (typeof notifyMapDataChanged === 'function') notifyMapDataChanged()`).

### State management

- `map` (module-level in `app.js`) — the Mapbox GL JS instance; `null` when in list view
- `map.userData` — all runtime app state lives on this object: pin arrays, `currentCompType`, `countyBoundaries`, `currentStyle` (active Mapbox style URL), measurement state (`isMeasuring`, `measurePaused`, `measureGeojson`, `measureLinestring`)
- `mapMarkers` (module-level in `map.js`) — array of all Mapbox `Marker` instances currently on the map
- `lastSavedState` / `lastSavedName` (in `app.js`) — JSON snapshots for dirty-checking (only pins + counties, not map position)

### Two views, one page

- **List view** (`#list-view`): saved maps displayed in either grid (cards) or table mode, toggled by `#btn-toggle-view`. Mode is persisted in `localStorage` as `listViewMode` (`'grid'` or `'table'`). Table mode supports sortable columns (name, date) and inline actions (note, copy link, clone, delete). Both modes share a `#map-search` filter.
- **Editor view** (`#editor-view`): Mapbox map with pin placement, county boundaries, measure tool, geocoder

`showListView()` tears down the map and resets all state. `showEditorView()` creates a fresh map. Both new-map and load-existing flows call `map.on('load', ...)` — any map-level initialization (layers, sources, event handlers) **must** go inside both `map.on('load')` callbacks.

### URL routing

Hash-based: `#map/{uuid}` deep-links to a saved map. `popstate` handler supports browser back/forward.

### Pin system

Four types with colors defined in `PIN_COLORS`: subject (red, max 1), sales (blue), rent (purple), land (green). Pins are stored as `subjectPins`, `salePins`, `rentPins`, `landPins` arrays on `map.userData` and serialized into `map_state` JSON in Supabase. `switchCompType()` shows/hides markers — subject pins are always visible.

### Basemap / satellite toggle

`#toggle-basemap` (`wa-switch`) in `#map-controls` switches the Mapbox style between `streets-v12` and `satellite-streets-v12`. The active style URL is stored in `map.userData.currentStyle` and serialized into `map_state` JSON so it is restored when a map is loaded. `showEditorView()` syncs the switch state to the restored style via `toggleBasemap.checked`.

### County boundaries

GeoJSON files in `data/counties/{CountyName}.geojson` for Georgia counties listed in `GEORGIA_COUNTIES` array (`counties-data.js`). Loaded on demand and rendered as a Mapbox line layer.

### Image export

`handleExportImage()` hides `#map-controls`, `#comp-type-controls`, and `#measure-widget` before html2canvas capture, restores them after (including in the error path). Export filename pattern: `{mapName}-{compType}.png`.

### Supabase schema

Single `maps` table with columns: `id` (UUID), `name`, `note`, `map_state` (JSONB), `created_at`, `updated_at`.

## Key Patterns

- Web Awesome dialogs are opened/closed via `dialog.open = true/false` and cleaned up on the `wa-hide` event with `{ once: true }`
- Event listeners on dialog buttons are added when the dialog opens and removed on close to prevent stacking
- The `hidden` CSS class (`display: none !important`) is the standard show/hide mechanism
- `map.userData.isMeasuring` guards pin placement — when measuring, map clicks add measure points instead of pins
- Config values (Mapbox token, Supabase URL/key) are in `js/config.js` — these are public client-side keys

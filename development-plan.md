
## Overview

Build a simple web application that allows users to create, save, open, and edit map templates using Mapbox GL JS. The app stores map configurations (center, zoom, bearing, pitch, style) in Supabase and allows users to manage multiple saved maps.

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Mapping**: Mapbox GL JS
- **Database**: Supabase (Postgres with REST API)
- **Hosting**: GitHub Pages (frontend only—no backend server needed)

## Why This Stack?

- No backend server required—Supabase provides REST API directly
- Familiar tools (vanilla JS, Mapbox GL JS)
- Free hosting via GitHub Pages
- Free database tier via Supabase
- Simple deployment: push to GitHub and it's live

---

## Architecture

This is a fully static application. The browser makes direct HTTP requests to Supabase—no backend server sits in between.

```
┌─────────────────────────┐         ┌─────────────────────────┐
│     GitHub Pages        │         │       Supabase          │
│  (Static HTML/JS/CSS)   │         │                         │
│                         │  HTTPS  │  ┌─────────────────┐    │
│  ┌───────────────────┐  │ ◄─────► │  │   REST API      │    │
│  │  Browser (User)   │  │  fetch  │  │   (PostgREST)   │    │
│  │                   │  │         │  └────────┬────────┘    │
│  │  - Vanilla JS     │  │         │           │             │
│  │  - Mapbox GL JS   │  │         │  ┌────────▼────────┐    │
│  └───────────────────┘  │         │  │    Postgres     │    │
│                         │         │  │    Database     │    │
└─────────────────────────┘         │  └─────────────────┘    │
                                    └─────────────────────────┘
```

**How CRUD works from the browser:**

| Operation | HTTP Method | Supabase Endpoint |
|-----------|-------------|-------------------|
| Create    | POST        | `/rest/v1/maps`   |
| Read      | GET         | `/rest/v1/maps`   |
| Update    | PATCH       | `/rest/v1/maps?id=eq.{uuid}` |
| Delete    | DELETE      | `/rest/v1/maps?id=eq.{uuid}` |

**Security Model:**

- The Supabase `anon` key is designed to be public (exposed in frontend code)
- Security is enforced via Row Level Security (RLS) policies in Postgres
- For this app, RLS is set to allow all operations (public read/write)
- No sensitive credentials are exposed

---

## Phase 1: Supabase Setup

### 1.1 Create the Database Table

In Supabase Dashboard → SQL Editor, run:

```sql
CREATE TABLE maps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    map_state JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create an index for faster name lookups
CREATE INDEX idx_maps_name ON maps(name);

-- Create a function to auto-update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function on updates
CREATE TRIGGER update_maps_updated_at
    BEFORE UPDATE ON maps
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
```

### 1.2 Configure Row Level Security (RLS)

For development/demo purposes, allow public access. In production, you'd add authentication.

```sql
-- Enable RLS
ALTER TABLE maps ENABLE ROW LEVEL SECURITY;

-- Allow all operations for now (adjust for production)
CREATE POLICY "Allow all operations" ON maps
    FOR ALL
    USING (true)
    WITH CHECK (true);
```

### 1.3 Get API Credentials

From Supabase Dashboard → Settings → API:
- Copy the **Project URL** (e.g., `https://xxxxx.supabase.co`)
- Copy the **anon/public key** (safe to use in frontend)

---

## Phase 2: Project Structure

```
map-templates/
├── index.html          # Main entry point
├── css/
│   └── styles.css      # All styles
├── js/
│   ├── config.js       # Supabase URL and anon key
│   ├── supabase.js     # Database operations
│   ├── map.js          # Mapbox GL JS initialization and controls
│   └── app.js          # Main application logic, UI state management
└── README.md           # Setup instructions
```

---

## Phase 3: Core Components

### 3.1 config.js

Store Supabase credentials (anon key is safe for frontend):

```javascript
const CONFIG = {
    SUPABASE_URL: 'https://your-project.supabase.co',
    SUPABASE_ANON_KEY: 'your-anon-key-here',
    MAPBOX_TOKEN: 'your-mapbox-token-here'
};
```

### 3.2 supabase.js - Database Operations

Implement these functions using Supabase REST API (via `fetch` or supabase-js client):

```javascript
// List all saved maps
async function getAllMaps() {
    // GET from Supabase, return array of {id, name, created_at, updated_at}
}

// Get a single map by ID
async function getMapById(id) {
    // GET single record, return full map_state
}

// Create a new map
async function createMap(name, mapState) {
    // POST to Supabase, return the created record
}

// Update an existing map
async function updateMap(id, name, mapState) {
    // PATCH to Supabase, return updated record
}

// Delete a map
async function deleteMap(id) {
    // DELETE from Supabase
}
```

### 3.3 map.js - Mapbox Integration

```javascript
// Initialize a new Mapbox GL JS map
function initializeMap(containerId, mapState = null) {
    // If mapState provided, use those settings
    // Otherwise use defaults (Atlanta center, zoom 10)
}

// Extract current map state for saving
function getMapState(map) {
    return {
        center: map.getCenter().toArray(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        style: map.getStyle().sprite // or store style URL
    };
}

// Apply a saved map state
function applyMapState(map, mapState) {
    map.jumpTo({
        center: mapState.center,
        zoom: mapState.zoom,
        bearing: mapState.bearing,
        pitch: mapState.pitch
    });
}
```

### 3.4 app.js - Application Logic

Manage two views:

1. **List View**: Shows all saved maps with options to open, delete, or create new
2. **Editor View**: Shows the map with save controls

```javascript
// State
let currentView = 'list'; // 'list' or 'editor'
let currentMapId = null;  // null for new map, UUID for existing
let map = null;           // Mapbox GL JS instance

// View switching
function showListView() { }
function showEditorView(mapId = null) { }

// List view actions
function renderMapList(maps) { }
function handleCreateNew() { }
function handleOpenMap(id) { }
function handleDeleteMap(id) { }

// Editor view actions
function handleSave() { }
function handleSaveAs() { }
function handleBackToList() { }
```

---

## Phase 4: UI Layout

### 4.1 HTML Structure

```html
<!DOCTYPE html>
<html>
<head>
    <title>Map Templates</title>
    <link href="https://api.mapbox.com/mapbox-gl-js/v3.x.x/mapbox-gl.css" rel="stylesheet">
    <link href="css/styles.css" rel="stylesheet">
</head>
<body>
    <!-- List View -->
    <div id="list-view">
        <header>
            <h1>Saved Maps</h1>
            <button id="btn-new-map">+ New Map</button>
        </header>
        <div id="maps-list">
            <!-- Populated dynamically -->
        </div>
    </div>

    <!-- Editor View -->
    <div id="editor-view" class="hidden">
        <header>
            <button id="btn-back">← Back</button>
            <input type="text" id="map-name" placeholder="Map name...">
            <button id="btn-save">Save</button>
            <button id="btn-save-as">Save As</button>
        </header>
        <div id="map-container"></div>
    </div>

    <script src="https://api.mapbox.com/mapbox-gl-js/v3.x.x/mapbox-gl.js"></script>
    <script src="js/config.js"></script>
    <script src="js/supabase.js"></script>
    <script src="js/map.js"></script>
    <script src="js/app.js"></script>
</body>
</html>
```

### 4.2 Key CSS Considerations

- List view: card-based layout for saved maps showing name, last updated
- Editor view: full-height map with fixed header toolbar
- Responsive design for different screen sizes
- Visual feedback for save/delete operations

---

## Phase 5: Implementation Order

Claude Code should implement in this order:

1. **Set up project structure** - Create all files and folders
2. **Implement config.js** - Add placeholder credentials with instructions
3. **Implement supabase.js** - All database operations using fetch API
4. **Implement map.js** - Mapbox initialization and state management
5. **Build index.html** - Complete HTML structure
6. **Style with CSS** - Clean, functional styling
7. **Implement app.js** - Wire everything together
8. **Add README.md** - Setup instructions for Supabase, Mapbox, and GitHub Pages
9. **Test locally** - Use VS Code Live Server or `python -m http.server`
10. **Deploy to GitHub Pages** - Push to GitHub and enable Pages in settings

---

## Phase 6: Default Map State

When creating a new map, use these defaults:

```javascript
const DEFAULT_MAP_STATE = {
    center: [-84.388, 33.749],  // Atlanta
    zoom: 10,
    bearing: 0,
    pitch: 0,
    style: 'mapbox://styles/mapbox/streets-v12'
};
```

---

## Future Enhancements (Out of Scope for Initial Build)

These are out of scope for the initial build but noted for later:

- [ ] Add layers to maps (markers, polygons, lines)
- [ ] User authentication via Supabase Auth
- [ ] Map thumbnails in list view
- [ ] Duplicate/copy map functionality
- [ ] Export map as image
- [ ] Share maps via public URLs
- [ ] Multiple basemap style options

---

## Phase 7: GitHub Pages Deployment

### 7.1 Repository Setup

1. Create a new GitHub repository (e.g., `map-templates`)
2. Clone locally and add all project files
3. Ensure `index.html` is in the root directory

### 7.2 Enable GitHub Pages

1. Go to repository **Settings** → **Pages**
2. Under "Source", select **Deploy from a branch**
3. Select **main** branch and **/ (root)** folder
4. Click **Save**
5. Wait 1-2 minutes for deployment
6. Your app will be live at: `https://{username}.github.io/{repo-name}/`

### 7.3 Deployment Workflow

After initial setup, deploying updates is simple:

```bash
git add .
git commit -m "Update map functionality"
git push origin main
# GitHub Pages automatically rebuilds (takes ~30 seconds)
```

### 7.4 Before Going Live Checklist

- [ ] Replace placeholder Supabase URL in `config.js`
- [ ] Replace placeholder Supabase anon key in `config.js`
- [ ] Replace placeholder Mapbox token in `config.js`
- [ ] Test all CRUD operations locally first
- [ ] Verify Supabase RLS policies are configured

---

## Notes for Claude Code

- Use the Supabase JavaScript client (`@supabase/supabase-js`) via CDN for simplicity
- Keep all JavaScript in vanilla JS—no build tools needed
- Ensure proper error handling for all async operations
- Add loading states for database operations
- Test with at least 3 saved maps to verify list functionality
- Map container needs explicit height (100vh minus header)

---

## Supabase REST API Reference

If not using supabase-js client, here's the raw REST API pattern:

```javascript
// Base headers for all requests
const headers = {
    'apikey': CONFIG.SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'  // Returns the modified row
};

// GET all maps
fetch(`${CONFIG.SUPABASE_URL}/rest/v1/maps?select=*&order=updated_at.desc`, {
    headers
});

// POST new map
fetch(`${CONFIG.SUPABASE_URL}/rest/v1/maps`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ name, map_state: mapState })
});

// PATCH update map
fetch(`${CONFIG.SUPABASE_URL}/rest/v1/maps?id=eq.${id}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({ name, map_state: mapState })
});

// DELETE map
fetch(`${CONFIG.SUPABASE_URL}/rest/v1/maps?id=eq.${id}`, {
    method: 'DELETE',
    headers
});
```

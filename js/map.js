// Mapbox GL JS integration and map state management

// Default map state for new maps
const DEFAULT_MAP_STATE = {
    center: [-84.388, 33.749],  // Atlanta
    zoom: 10,
    bearing: 0,
    pitch: 0,
    style: 'mapbox://styles/mapbox/streets-v12'
};

/**
 * Initialize a new Mapbox GL JS map
 * @param {string} containerId - ID of the container element
 * @param {Object} mapState - Optional map state to restore (uses defaults if not provided)
 * @returns {mapboxgl.Map} Initialized map instance
 */
function initializeMap(containerId, mapState = null) {
    // Use provided state or defaults
    const state = mapState || DEFAULT_MAP_STATE;

    // Set Mapbox access token
    mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

    // Create and return the map
    const map = new mapboxgl.Map({
        container: containerId,
        style: state.style,
        center: state.center,
        zoom: state.zoom,
        bearing: state.bearing,
        pitch: state.pitch
    });

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add fullscreen control
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    return map;
}

/**
 * Extract current map state for saving
 * @param {mapboxgl.Map} map - The map instance
 * @returns {Object} Map state object
 */
function getMapState(map) {
    return {
        center: map.getCenter().toArray(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
        style: map.getStyle().sprite ? 'mapbox://styles/mapbox/streets-v12' : map.getStyle().sprite
    };
}

/**
 * Apply a saved map state to an existing map
 * @param {mapboxgl.Map} map - The map instance
 * @param {Object} mapState - The state to apply
 */
function applyMapState(map, mapState) {
    map.jumpTo({
        center: mapState.center,
        zoom: mapState.zoom,
        bearing: mapState.bearing,
        pitch: mapState.pitch
    });

    // Update style if different
    if (mapState.style && map.getStyle().sprite !== mapState.style) {
        map.setStyle(mapState.style);
    }
}

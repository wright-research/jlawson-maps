// Mapbox GL JS integration and map state management

// Default map state for new maps
const DEFAULT_MAP_STATE = {
    center: [-83.82447702235812, 34.304740783725165],  // North Georgia
    zoom: 10,
    bearing: 0,
    pitch: 0,
    style: 'mapbox://styles/mapbox/streets-v12',
    pins: [],
    countyBoundaries: {
        enabled: false,
        selectedCounties: []
    }
};

// Track map markers and state
let mapMarkers = [];
let nextPinId = 1;

/**
 * Initialize a new Mapbox GL JS map
 * @param {string} containerId - ID of the container element
 * @param {Object} mapState - Optional map state to restore (uses defaults if not provided)
 * @returns {mapboxgl.Map} Initialized map instance
 */
function initializeMap(containerId, mapState = null) {
    // Use provided state or defaults
    const state = { ...DEFAULT_MAP_STATE, ...(mapState || {}) };

    // Set Mapbox access token
    mapboxgl.accessToken = CONFIG.MAPBOX_TOKEN;

    // Create and return the map
    const map = new mapboxgl.Map({
        container: containerId,
        style: state.style || 'mapbox://styles/mapbox/streets-v12',
        center: state.center,
        zoom: state.zoom,
        bearing: state.bearing,
        pitch: state.pitch,
        preserveDrawingBuffer: true  // Required for exporting canvas to image
    });

    // Add navigation controls
    map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    // Add fullscreen control
    map.addControl(new mapboxgl.FullscreenControl(), 'top-right');

    // Initialize map data storage
    map.userData = {
        pins: state.pins || [],
        countyBoundaries: state.countyBoundaries || DEFAULT_MAP_STATE.countyBoundaries
    };

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
        style: 'mapbox://styles/mapbox/streets-v12',
        pins: map.userData?.pins || [],
        countyBoundaries: map.userData?.countyBoundaries || DEFAULT_MAP_STATE.countyBoundaries
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

/**
 * Enable click-to-add pins on the map
 * @param {mapboxgl.Map} map - The map instance
 */
function enablePinPlacement(map) {
    map.on('click', (e) => {
        // Don't add pin if clicking on existing marker
        const features = map.queryRenderedFeatures(e.point);
        const clickedMarker = features.find(f => f.layer?.id?.startsWith('marker-'));
        if (clickedMarker) return;

        addPin(map, e.lngLat);
    });
}

/**
 * Add a pin to the map
 * @param {mapboxgl.Map} map - The map instance
 * @param {Object} lngLat - The {lng, lat} coordinates
 */
function addPin(map, lngLat) {
    const pinNumber = (map.userData.pins.length || 0) + 1;
    const pinId = `pin-${nextPinId++}`;

    const pinData = {
        id: pinId,
        lngLat: [lngLat.lng, lngLat.lat],
        number: pinNumber
    };

    // Create marker element
    const el = createPinElement(pinNumber);

    // Create marker with anchor at bottom of pin
    const marker = new mapboxgl.Marker({
        element: el,
        draggable: true,
        anchor: 'bottom'
    })
        .setLngLat(lngLat)
        .addTo(map);

    // Store reference
    marker.pinData = pinData;
    marker.isDragging = false;
    mapMarkers.push(marker);

    // Track drag start
    marker.on('dragstart', () => {
        marker.isDragging = true;
    });

    // Update pin data on drag
    marker.on('dragend', () => {
        const newLngLat = marker.getLngLat();
        pinData.lngLat = [newLngLat.lng, newLngLat.lat];
        updateMapPins(map);

        // Reset drag flag after a brief delay to prevent click event
        setTimeout(() => {
            marker.isDragging = false;
        }, 100);
    });

    // Click on marker to edit/delete (but not after dragging)
    el.addEventListener('click', (e) => {
        e.stopPropagation();

        // Don't show menu if we just finished dragging
        if (!marker.isDragging) {
            showPinMenu(map, marker);
        }
    });

    // Add to map user data
    map.userData.pins.push(pinData);
}

/**
 * Create a pin marker element
 * @param {number} number - The pin number
 * @returns {HTMLElement} The marker element
 */
function createPinElement(number) {
    const el = document.createElement('div');
    el.className = 'map-pin';
    el.innerHTML = `<span>${number}</span>`;
    return el;
}

/**
 * Show menu for editing/deleting a pin
 * @param {mapboxgl.Map} map - The map instance
 * @param {mapboxgl.Marker} marker - The marker to edit
 */
async function showPinMenu(map, marker) {
    const result = await Swal.fire({
        title: `Edit Pin ${marker.pinData.number}`,
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'Renumber',
        cancelButtonText: 'Delete',
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#dc2626'
    });

    if (result.isConfirmed) {
        // Renumber
        const { value: newNumber } = await Swal.fire({
            title: 'Renumber Pin',
            input: 'number',
            inputLabel: 'Enter new number',
            inputValue: marker.pinData.number,
            showCancelButton: true,
            confirmButtonColor: '#2563eb',
            inputValidator: (value) => {
                if (!value || isNaN(value)) {
                    return 'Please enter a valid number';
                }
            }
        });

        if (newNumber) {
            const num = parseInt(newNumber, 10);
            marker.pinData.number = num;
            marker.getElement().querySelector('span').textContent = num;
            updateMapPins(map);
        }
    } else if (result.dismiss === Swal.DismissReason.cancel) {
        // Delete - confirm first
        const confirmDelete = await Swal.fire({
            title: 'Delete this pin?',
            text: 'This cannot be undone',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, delete it',
            cancelButtonText: 'No, keep it',
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280'
        });

        if (confirmDelete.isConfirmed) {
            deletePin(map, marker);
        }
    }
}

/**
 * Delete a pin from the map
 * @param {mapboxgl.Map} map - The map instance
 * @param {mapboxgl.Marker} marker - The marker to delete
 */
function deletePin(map, marker) {
    // Remove from markers array
    const index = mapMarkers.indexOf(marker);
    if (index > -1) {
        mapMarkers.splice(index, 1);
    }

    // Remove from map user data
    const dataIndex = map.userData.pins.findIndex(p => p.id === marker.pinData.id);
    if (dataIndex > -1) {
        map.userData.pins.splice(dataIndex, 1);
    }

    // Remove marker from map
    marker.remove();
}

/**
 * Update map pins data from current markers
 * @param {mapboxgl.Map} map - The map instance
 */
function updateMapPins(map) {
    map.userData.pins = mapMarkers.map(marker => ({
        id: marker.pinData.id,
        lngLat: marker.pinData.lngLat,
        number: marker.pinData.number
    }));
}

/**
 * Restore pins from saved state
 * @param {mapboxgl.Map} map - The map instance
 * @param {Array} pins - Array of pin data
 */
function restorePins(map, pins) {
    // Clear existing markers
    clearAllPins(map);

    // Add each saved pin
    pins.forEach(pinData => {
        const el = createPinElement(pinData.number);

        const marker = new mapboxgl.Marker({
            element: el,
            draggable: true,
            anchor: 'bottom'
        })
            .setLngLat(pinData.lngLat)
            .addTo(map);

        marker.pinData = { ...pinData };
        marker.isDragging = false;
        mapMarkers.push(marker);

        // Track drag start
        marker.on('dragstart', () => {
            marker.isDragging = true;
        });

        // Update pin data on drag
        marker.on('dragend', () => {
            const newLngLat = marker.getLngLat();
            marker.pinData.lngLat = [newLngLat.lng, newLngLat.lat];
            updateMapPins(map);

            // Reset drag flag after a brief delay to prevent click event
            setTimeout(() => {
                marker.isDragging = false;
            }, 100);
        });

        // Click on marker to edit/delete (but not after dragging)
        el.addEventListener('click', (e) => {
            e.stopPropagation();

            // Don't show menu if we just finished dragging
            if (!marker.isDragging) {
                showPinMenu(map, marker);
            }
        });

        // Track highest pin ID
        const idNum = parseInt(pinData.id.split('-')[1], 10);
        if (idNum >= nextPinId) {
            nextPinId = idNum + 1;
        }
    });

    map.userData.pins = pins;
}

/**
 * Clear all pins from the map
 * @param {mapboxgl.Map} map - The map instance
 */
function clearAllPins(map) {
    mapMarkers.forEach(marker => marker.remove());
    mapMarkers = [];
    map.userData.pins = [];
}

/**
 * Update county boundaries on the map
 * @param {mapboxgl.Map} map - The map instance
 * @param {boolean} enabled - Whether to show boundaries
 * @param {Array<string>} selectedCounties - Array of county names to display
 */
async function updateCountyBoundaries(map, enabled, selectedCounties) {
    // Update user data
    map.userData.countyBoundaries = {
        enabled,
        selectedCounties: selectedCounties || []
    };

    // Remove existing layers and sources
    if (map.getLayer('county-boundaries-line')) {
        map.removeLayer('county-boundaries-line');
    }
    if (map.getSource('counties')) {
        map.removeSource('counties');
    }

    // Add new layers if enabled and counties selected
    if (enabled && selectedCounties && selectedCounties.length > 0) {
        try {
            const geojson = await fetchGeorgiaCounties(selectedCounties);

            if (!map.getSource('counties')) {
                map.addSource('counties', {
                    type: 'geojson',
                    data: geojson
                });
            }

            // Add outline layer (no fill, just black border)
            map.addLayer({
                id: 'county-boundaries-line',
                type: 'line',
                source: 'counties',
                paint: {
                    'line-color': '#000000',
                    'line-width': 2
                }
            });
        } catch (error) {
            console.error('Error loading county boundaries:', error);
        }
    }
}

/**
 * Restore county boundaries from saved state
 * @param {mapboxgl.Map} map - The map instance
 * @param {Object} countyBoundaries - County boundaries state
 */
async function restoreCountyBoundaries(map, countyBoundaries) {
    if (!countyBoundaries) return;

    await updateCountyBoundaries(
        map,
        countyBoundaries.enabled,
        countyBoundaries.selectedCounties
    );
}

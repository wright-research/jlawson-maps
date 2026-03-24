// Mapbox GL JS integration and map state management

// Default map state for new maps
const DEFAULT_MAP_STATE = {
    center: [-83.82447702235812, 34.304740783725165],  // North Georgia
    zoom: 10,
    bearing: 0,
    pitch: 0,
    style: 'mapbox://styles/mapbox/streets-v12',
    subjectPins: [],
    salePins: [],
    rentPins: [],
    landPins: [],
    countyBoundaries: {
        enabled: false,
        selectedCounties: []
    }
};

// Pin colors for each comp type
const PIN_COLORS = {
    subject: '#e41a1c',
    sales: '#377eb8',
    rent: '#984ea3',
    land: '#4daf4a'
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

    // disable map rotation using right click + drag
    map.dragRotate.disable();

    // disable map rotation using touch rotation gesture
    map.touchZoomRotate.disableRotation();

    // Initialize map data storage
    map.userData = {
        subjectPins: state.subjectPins || [],
        salePins: state.salePins || [],
        rentPins: state.rentPins || [],
        landPins: state.landPins || [],
        currentCompType: state.currentCompType || 'subject', // Track which layer is active
        countyBoundaries: state.countyBoundaries || DEFAULT_MAP_STATE.countyBoundaries,
        currentStyle: state.style || 'mapbox://styles/mapbox/streets-v12'
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
        style: map.userData.currentStyle || 'mapbox://styles/mapbox/streets-v12',
        subjectPins: map.userData?.subjectPins || [],
        salePins: map.userData?.salePins || [],
        rentPins: map.userData?.rentPins || [],
        landPins: map.userData?.landPins || [],
        currentCompType: map.userData?.currentCompType || 'subject',
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
        // Don't add pin if measurement mode is active
        if (map.userData.isMeasuring) return;

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
    const compType = map.userData.currentCompType || 'subject';
    const pinArrayKey = compType === 'subject' ? 'subjectPins' : compType === 'sales' ? 'salePins' : compType === 'rent' ? 'rentPins' : 'landPins';
    const pinArray = map.userData[pinArrayKey];

    // Limit to one subject pin
    if (compType === 'subject' && pinArray.length > 0) {
        const dialog = document.getElementById('dialog-warning');
        const message = document.getElementById('warning-message');
        message.textContent = 'Map can only have one subject pin! You can delete the existing subject pin by clicking on it.';
        dialog.open = true;
        return;
    }

    const pinLabel = compType === 'subject' ? 'S' : (pinArray.length || 0) + 1;
    const pinId = `pin-${nextPinId++}`;
    const pinColor = PIN_COLORS[compType];

    const pinData = {
        id: pinId,
        lngLat: [lngLat.lng, lngLat.lat],
        number: pinLabel,
        type: compType
    };

    // Create marker element with appropriate color
    const el = createPinElement(pinLabel, pinColor);

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
    marker.compType = compType;
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

    // Add to appropriate pin array
    pinArray.push(pinData);

    // Notify app of data change
    if (typeof notifyMapDataChanged === 'function') notifyMapDataChanged();
}

/**
 * Create a pin marker element
 * @param {number} number - The pin number
 * @param {string} color - The pin color (hex code)
 * @returns {HTMLElement} The marker element
 */
function createPinElement(number, color = '#e41a1c') {
    const el = document.createElement('div');
    el.className = 'map-pin';
    el.innerHTML = `<div class="pin-head" style="background-color: ${color};"><span>${number}</span></div><div class="pin-stem" style="background-color: ${color};"></div>`;
    return el;
}

/**
 * Show menu for editing/deleting a pin
 * @param {mapboxgl.Map} map - The map instance
 * @param {mapboxgl.Marker} marker - The marker to edit
 */
function showPinMenu(map, marker) {
    const dialog = document.getElementById('dialog-edit-pin');
    const input = document.getElementById('pin-renumber-input');
    const renumberBtn = document.getElementById('confirm-renumber-pin');
    const deleteBtn = document.getElementById('confirm-delete-pin');
    const renumberSection = input.closest('div');

    const isSubject = marker.compType === 'subject';

    // Set dialog title and input value
    dialog.label = isSubject ? 'Edit Subject Pin' : `Edit Pin ${marker.pinData.number}`;

    // Hide renumber input and button for subject pins
    if (isSubject) {
        renumberSection.style.display = 'none';
        renumberBtn.style.display = 'none';
    } else {
        renumberSection.style.display = '';
        renumberBtn.style.display = '';
        input.value = marker.pinData.number;
    }

    // Show dialog
    dialog.open = true;

    // Focus input after dialog opens (only for non-subject pins)
    if (!isSubject) {
        setTimeout(() => input.focus(), 100);
    }

    // Handle renumber button click
    const handleRenumber = () => {
        const newNumber = parseInt(input.value, 10);

        if (!newNumber || isNaN(newNumber)) {
            input.style.borderColor = '#e41a1c';
            return;
        }

        // Reset styling
        input.style.borderColor = '#d1d5db';

        // Update pin number
        marker.pinData.number = newNumber;
        marker.getElement().querySelector('span').textContent = newNumber;
        updateMapPins(map);

        // Close dialog
        dialog.open = false;

        // Remove listeners
        cleanup();
    };

    // Handle delete button click
    const handleDelete = () => {
        deletePin(map, marker);
        dialog.open = false;
        cleanup();
    };

    // Cleanup function
    const cleanup = () => {
        renumberBtn.removeEventListener('click', handleRenumber);
        deleteBtn.removeEventListener('click', handleDelete);
        input.removeEventListener('keypress', handleEnter);
        input.style.borderColor = '#d1d5db';
    };

    // Handle Enter key in input
    const handleEnter = (e) => {
        if (e.key === 'Enter') {
            handleRenumber();
        }
    };

    // Add listeners
    renumberBtn.addEventListener('click', handleRenumber);
    deleteBtn.addEventListener('click', handleDelete);
    input.addEventListener('keypress', handleEnter);

    // Clean up on dialog close
    dialog.addEventListener('wa-hide', cleanup, { once: true });
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

    // Remove from appropriate pin array based on comp type
    const compType = marker.compType || 'sales';
    const pinArrayKey = compType === 'subject' ? 'subjectPins' : compType === 'sales' ? 'salePins' : compType === 'rent' ? 'rentPins' : 'landPins';
    const pinArray = map.userData[pinArrayKey];

    if (pinArray) {
        const dataIndex = pinArray.findIndex(p => p.id === marker.pinData.id);
        if (dataIndex > -1) {
            pinArray.splice(dataIndex, 1);
        }
    }

    // Remove marker from map
    marker.remove();

    // Notify app of data change
    if (typeof notifyMapDataChanged === 'function') notifyMapDataChanged();
}

/**
 * Update map pins data from current markers
 * @param {mapboxgl.Map} map - The map instance
 */
function updateMapPins(map) {
    // Separate markers by type
    map.userData.subjectPins = mapMarkers
        .filter(marker => marker.compType === 'subject')
        .map(marker => ({
            id: marker.pinData.id,
            lngLat: marker.pinData.lngLat,
            number: marker.pinData.number,
            type: 'subject'
        }));

    map.userData.salePins = mapMarkers
        .filter(marker => marker.compType === 'sales')
        .map(marker => ({
            id: marker.pinData.id,
            lngLat: marker.pinData.lngLat,
            number: marker.pinData.number,
            type: 'sales'
        }));

    map.userData.rentPins = mapMarkers
        .filter(marker => marker.compType === 'rent')
        .map(marker => ({
            id: marker.pinData.id,
            lngLat: marker.pinData.lngLat,
            number: marker.pinData.number,
            type: 'rent'
        }));

    map.userData.landPins = mapMarkers
        .filter(marker => marker.compType === 'land')
        .map(marker => ({
            id: marker.pinData.id,
            lngLat: marker.pinData.lngLat,
            number: marker.pinData.number,
            type: 'land'
        }));

    // Notify app of data change
    if (typeof notifyMapDataChanged === 'function') notifyMapDataChanged();
}

/**
 * Restore pins from saved state
 * @param {mapboxgl.Map} map - The map instance
 * @param {Object} mapState - Map state containing pin arrays
 */
function restorePins(map, mapState) {
    // Clear existing markers
    clearAllPins(map);

    // Restore all four pin types
    const allPins = [
        ...(mapState.subjectPins || []).map(p => ({ ...p, type: 'subject' })),
        ...(mapState.salePins || []).map(p => ({ ...p, type: 'sales' })),
        ...(mapState.rentPins || []).map(p => ({ ...p, type: 'rent' })),
        ...(mapState.landPins || []).map(p => ({ ...p, type: 'land' }))
    ];

    // Add each saved pin
    allPins.forEach(pinData => {
        const compType = pinData.type || 'sales';
        const pinColor = PIN_COLORS[compType];
        const el = createPinElement(pinData.number, pinColor);

        const marker = new mapboxgl.Marker({
            element: el,
            draggable: true,
            anchor: 'bottom'
        })
            .setLngLat(pinData.lngLat)
            .addTo(map);

        marker.pinData = { ...pinData };
        marker.isDragging = false;
        marker.compType = compType;
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

    // Update map user data
    map.userData.subjectPins = mapState.subjectPins || [];
    map.userData.salePins = mapState.salePins || [];
    map.userData.rentPins = mapState.rentPins || [];
    map.userData.landPins = mapState.landPins || [];
}

/**
 * Clear all pins from the map
 * @param {mapboxgl.Map} map - The map instance
 */
function clearAllPins(map) {
    mapMarkers.forEach(marker => marker.remove());
    mapMarkers = [];
    map.userData.subjectPins = [];
    map.userData.salePins = [];
    map.userData.rentPins = [];
    map.userData.landPins = [];
}

/**
 * Switch visible pins based on comp type
 * @param {mapboxgl.Map} map - The map instance
 * @param {string} compType - The comp type ('sales', 'rent', or 'land')
 */
function switchCompType(map, compType) {
    map.userData.currentCompType = compType;

    // Show/hide markers based on comp type (subject pins always visible)
    mapMarkers.forEach(marker => {
        if (marker.compType === 'subject' || marker.compType === compType) {
            marker.getElement().style.display = '';
        } else {
            marker.getElement().style.display = 'none';
        }
    });
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

            // Add outline layer — white on satellite, black on streets
            const lineColor = map.userData.currentStyle === 'mapbox://styles/mapbox/satellite-streets-v12'
                ? '#ffffff'
                : '#000000';
            map.addLayer({
                id: 'county-boundaries-line',
                type: 'line',
                source: 'counties',
                paint: {
                    'line-color': lineColor,
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

/**
 * Add measurement tool GeoJSON sources and layers to the map.
 * Called on initial load and after style changes (which wipe custom layers).
 * Does NOT reset measurement state or attach event handlers.
 * @param {mapboxgl.Map} map - The map instance
 */
function addMeasurementSourcesAndLayers(map) {
    map.addSource('measure-geojson', {
        type: 'geojson',
        data: map.userData.measureGeojson
    });

    map.addLayer({
        id: 'measure-points',
        type: 'circle',
        source: 'measure-geojson',
        paint: { 'circle-radius': 5, 'circle-color': '#000' },
        filter: ['in', '$type', 'Point']
    });

    map.addLayer({
        id: 'measure-lines',
        type: 'line',
        source: 'measure-geojson',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': '#000', 'line-width': 2.5 },
        filter: ['in', '$type', 'LineString']
    });

    // Rubber-band preview line (dotted, from last point to cursor)
    map.addSource('measure-preview', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });

    map.addLayer({
        id: 'measure-preview-line',
        type: 'line',
        source: 'measure-preview',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: {
            'line-color': '#374151',
            'line-width': 2,
            'line-dasharray': [3, 3],
            'line-opacity': 0.7
        }
    });

    // Distance label that follows the rubber-band preview line midpoint
    map.addSource('measure-preview-label', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });

    map.addLayer({
        id: 'measure-preview-label-layer',
        type: 'symbol',
        source: 'measure-preview-label',
        layout: {
            'text-field': ['get', 'label'],
            'text-size': 12,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-offset': [0, -0.8],
            'text-anchor': 'bottom',
            'text-allow-overlap': true
        },
        paint: {
            'text-color': '#4b5563',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2
        }
    });

    // Separate source for per-segment distance labels
    map.addSource('measure-labels', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] }
    });

    map.addLayer({
        id: 'measure-segment-labels',
        type: 'symbol',
        source: 'measure-labels',
        layout: {
            'text-field': ['get', 'label'],
            'text-size': 12,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-offset': [0, -0.8],
            'text-anchor': 'bottom',
            'text-allow-overlap': true
        },
        paint: {
            'text-color': '#111827',
            'text-halo-color': '#ffffff',
            'text-halo-width': 2
        }
    });
}

/**
 * Initialize the measurement tool GeoJSON sources, layers, and event handlers
 * @param {mapboxgl.Map} map - The map instance
 */
function initializeMeasurementTool(map) {
    map.userData.isMeasuring = false;
    map.userData.measurePaused = false;
    map.userData.measureGeojson = { type: 'FeatureCollection', features: [] };
    map.userData.measureLinestring = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [] }
    };

    addMeasurementSourcesAndLayers(map);

    map.on('click', (e) => {
        if (!map.userData.isMeasuring) return;

        const geojson = map.userData.measureGeojson;
        const linestring = map.userData.measureLinestring;

        if (geojson.features.length > 1) geojson.features.pop(); // remove old linestring

        const features = map.queryRenderedFeatures(e.point, { layers: ['measure-points'] });

        if (features.length) {
            const id = features[0].properties.id;
            geojson.features = geojson.features.filter(p => p.properties.id !== id);
        } else {
            geojson.features.push({
                type: 'Feature',
                geometry: { type: 'Point', coordinates: [e.lngLat.lng, e.lngLat.lat] },
                properties: { id: String(new Date().getTime()) }
            });
        }

        if (geojson.features.length > 1) {
            linestring.geometry.coordinates = geojson.features.map(p => p.geometry.coordinates);
            geojson.features.push(linestring);
        }

        map.getSource('measure-geojson').setData(geojson);

        // Resume rubber-band preview from the new last point
        map.userData.measurePaused = false;

        if (typeof updateMeasureDisplay === 'function') updateMeasureDisplay(map);
    });

    map.on('mousemove', (e) => {
        if (!map.userData.isMeasuring) return;

        const features = map.queryRenderedFeatures(e.point, { layers: ['measure-points'] });
        map.getCanvas().style.cursor = features.length ? 'pointer' : 'crosshair';

        // When paused (user clicked Finish), hide preview until next click
        if (map.userData.measurePaused) return;

        const points = map.userData.measureGeojson.features.filter(f => f.geometry.type === 'Point');
        const previewSource = map.getSource('measure-preview');
        const previewLabelSource = map.getSource('measure-preview-label');
        if (!previewSource) return;

        if (points.length > 0) {
            const lastCoord = points[points.length - 1].geometry.coordinates;
            const currentCoord = [e.lngLat.lng, e.lngLat.lat];

            previewSource.setData({
                type: 'FeatureCollection',
                features: [{
                    type: 'Feature',
                    geometry: { type: 'LineString', coordinates: [lastCoord, currentCoord] },
                    properties: {}
                }]
            });

            // Distance label at the midpoint of the preview segment
            if (previewLabelSource) {
                const unit = document.querySelector('input[name="measure-unit"]:checked')?.value || 'miles';
                const dist = turf.length(turf.lineString([lastCoord, currentCoord]), { units: unit });
                const mid = turf.midpoint(turf.point(lastCoord), turf.point(currentCoord));
                mid.properties = {
                    label: unit === 'feet'
                        ? `${Math.round(dist).toLocaleString()} ft`
                        : `${dist.toFixed(2)} mi`
                };
                previewLabelSource.setData({ type: 'FeatureCollection', features: [mid] });
            }
        } else {
            previewSource.setData({ type: 'FeatureCollection', features: [] });
            if (previewLabelSource) {
                previewLabelSource.setData({ type: 'FeatureCollection', features: [] });
            }
        }
    });
}

/**
 * Reset measurement data and clear the map source
 * @param {mapboxgl.Map} map - The map instance
 */
function resetMeasurement(map) {
    if (!map || !map.userData) return;
    map.userData.measureGeojson = { type: 'FeatureCollection', features: [] };
    map.userData.measureLinestring = {
        type: 'Feature',
        geometry: { type: 'LineString', coordinates: [] }
    };
    map.userData.measurePaused = false;
    const empty = { type: 'FeatureCollection', features: [] };
    if (map.getSource('measure-geojson')) map.getSource('measure-geojson').setData(map.userData.measureGeojson);
    if (map.getSource('measure-labels')) map.getSource('measure-labels').setData(empty);
    if (map.getSource('measure-preview')) map.getSource('measure-preview').setData(empty);
    if (map.getSource('measure-preview-label')) map.getSource('measure-preview-label').setData(empty);
}

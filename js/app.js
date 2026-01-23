// Main application logic and UI state management

// Application state
let currentView = 'list'; // 'list' or 'editor'
let currentMapId = null;  // null for new map, UUID for existing
let map = null;           // Mapbox GL JS instance
let geocoder = null;      // Mapbox Geocoder instance
let lastSavedState = null; // Last saved map state for tracking changes

// DOM elements
const listView = document.getElementById('list-view');
const editorView = document.getElementById('editor-view');
const mapsList = document.getElementById('maps-list');
const loadingList = document.getElementById('loading-list');
const emptyState = document.getElementById('empty-state');
const loadingEditor = document.getElementById('loading-editor');
const mapNameInput = document.getElementById('map-name');
const toggleCounties = document.getElementById('toggle-counties');
const countySelect = document.getElementById('county-select');
const countySelectContainer = document.getElementById('county-select-container');
const compTypeRadioGroup = document.getElementById('comp-type-radio-group');
const mapSearch = document.getElementById('map-search');

// Buttons
const btnNewMap = document.getElementById('btn-new-map');
const btnBack = document.getElementById('btn-back');
const btnExportImage = document.getElementById('btn-export-image');
const btnSave = document.getElementById('btn-save');

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

/**
 * Initialize the application
 */
async function initializeApp() {
    // Set radio group orientation based on screen size
    function updateRadioGroupOrientation() {
        const isMobile = window.innerWidth <= 768;
        if (isMobile) {
            compTypeRadioGroup.setAttribute('orientation', 'horizontal');
        } else {
            compTypeRadioGroup.setAttribute('orientation', 'vertical');
        }
    }

    // Set initial orientation
    updateRadioGroupOrientation();

    // Update on window resize
    window.addEventListener('resize', updateRadioGroupOrientation);

    // Attach event listeners
    btnNewMap.addEventListener('click', handleCreateNew);
    btnBack.addEventListener('click', handleBackToList);
    btnExportImage.addEventListener('click', handleExportImage);
    btnSave.addEventListener('click', handleSave);

    // Add Enter key listener to map name input
    mapNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        }
    });

    // Populate county select dropdown
    populateCountySelect();

    // Add county controls event listeners
    toggleCounties.addEventListener('change', handleCountyToggle);
    countySelect.addEventListener('change', handleCountySelection);

    // Add comp type radio group event listener
    compTypeRadioGroup.addEventListener('change', handleCompTypeChange);

    // Add search functionality
    mapSearch.addEventListener('input', handleSearch);

    // Handle browser back/forward buttons
    window.addEventListener('popstate', handleUrlChange);

    // Check URL for map ID and open it if present
    const urlMapId = getMapIdFromUrl();
    if (urlMapId) {
        await showEditorView(urlMapId);
    } else {
        // Load and display map list
        await showListView();
    }
}

/**
 * Handle URL changes from browser back/forward buttons
 */
async function handleUrlChange() {
    const urlMapId = getMapIdFromUrl();
    if (urlMapId && urlMapId !== currentMapId) {
        // Load the map from the URL (don't update history since URL already changed)
        await showEditorView(urlMapId, 'Untitled Map', false);
    } else if (!urlMapId && currentView === 'editor') {
        // Return to list view (don't update history since URL already changed)
        await showListView(false);
    }
}

/**
 * Populate the county select dropdown
 */
function populateCountySelect() {
    const counties = getAvailableCounties();
    countySelect.innerHTML = '';

    counties.forEach(county => {
        const option = document.createElement('option');
        option.value = county;
        option.textContent = county;
        countySelect.appendChild(option);
    });
}

/**
 * Handle county boundaries toggle
 */
async function handleCountyToggle(e) {
    const enabled = e.target.checked;
    const toggleContainer = document.getElementById('toggle-counties-container');

    // Show/hide county select dropdown and add/remove margin
    if (enabled) {
        countySelectContainer.classList.remove('hidden');
        toggleContainer.classList.add('switch-on');
    } else {
        countySelectContainer.classList.add('hidden');
        toggleContainer.classList.remove('switch-on');
    }

    if (!map) return;

    const selectedCounties = getSelectedCounties();
    await updateCountyBoundaries(map, enabled, selectedCounties);
}

/**
 * Handle county selection change
 */
async function handleCountySelection() {
    if (!map) return;

    const enabled = toggleCounties.checked;
    const selectedCounties = getSelectedCounties();

    if (enabled) {
        await updateCountyBoundaries(map, enabled, selectedCounties);
    }
}

/**
 * Get selected counties from the multiselect
 * @returns {Array<string>} Array of selected county names
 */
function getSelectedCounties() {
    const selected = [];
    for (let option of countySelect.options) {
        if (option.selected) {
            selected.push(option.value);
        }
    }
    return selected;
}

/**
 * Handle comp type radio group change
 */
function handleCompTypeChange(e) {
    if (!map) return;

    const compType = e.target.value;
    switchCompType(map, compType);
}

/**
 * Initialize the geocoder for the map
 */
function initializeGeocoder() {
    // Clean up existing geocoder if it exists
    if (geocoder) {
        geocoder = null;
    }

    // Clear the geocoder container
    const geocoderContainer = document.getElementById('geocoder-container');
    geocoderContainer.innerHTML = '';

    if (!map) return;

    // Create new geocoder instance
    geocoder = new MapboxGeocoder({
        accessToken: mapboxgl.accessToken,
        mapboxgl: mapboxgl,
        marker: true, // Don't add a marker to the map
        bbox: [-85.63821630640555, 30.28790342288366, -79.64545775687766, 35.03288781998237],
        placeholder: 'Search for an address'
    });

    // Add the geocoder to the container
    geocoderContainer.appendChild(geocoder.onAdd(map));
}

/**
 * Show the list view and load all maps
 * @param {boolean} updateHistory - Whether to update browser history (default: true)
 */
async function showListView(updateHistory = true) {
    currentView = 'list';
    currentMapId = null;
    lastSavedState = null;

    // Clean up geocoder instance if it exists
    if (geocoder) {
        geocoder = null;
        document.getElementById('geocoder-container').innerHTML = '';
    }

    // Clean up map instance if it exists
    if (map) {
        map.remove();
        map = null;
    }

    // Switch views
    listView.classList.remove('hidden');
    editorView.classList.add('hidden');

    // Clear URL
    if (updateHistory) {
        updateUrl(null);
    }

    // Clear search box
    mapSearch.value = '';

    // Load maps
    await loadMapsList();
}

/**
 * Show the editor view
 * @param {string|null} mapId - UUID of map to load, or null for new map
 * @param {string} mapName - Optional name for new maps
 * @param {boolean} updateHistory - Whether to update browser history (default: true)
 */
async function showEditorView(mapId = null, mapName = 'Untitled Map', updateHistory = true) {
    currentView = 'editor';
    currentMapId = mapId;

    // Switch views
    listView.classList.add('hidden');
    editorView.classList.remove('hidden');

    // Update URL if we have a map ID
    if (updateHistory) {
        if (mapId) {
            updateUrl(mapId);
        } else {
            updateUrl(null);
        }
    }

    // Wait for DOM to settle before initializing map
    await new Promise(resolve => requestAnimationFrame(resolve));

    if (mapId) {
        // Load existing map
        await loadExistingMap(mapId);
    } else {
        // Create new map with defaults
        mapNameInput.value = mapName;
        map = initializeMap('map-container');

        // Enable pin placement and setup controls
        map.on('load', () => {
            // Resize to ensure proper dimensions
            requestAnimationFrame(() => {
                map.resize();
            });
            enablePinPlacement(map);
            setupMapControls();
            initializeGeocoder();
        });
    }
}

/**
 * Setup map controls UI from current map state
 */
function setupMapControls() {
    if (!map || !map.userData) return;

    const toggleContainer = document.getElementById('toggle-counties-container');

    // Setup county controls
    const boundaries = map.userData.countyBoundaries;
    if (boundaries) {
        // Set wa-switch checked state
        toggleCounties.checked = boundaries.enabled;

        // Show/hide county select based on enabled state and add/remove margin
        if (boundaries.enabled) {
            countySelectContainer.classList.remove('hidden');
            toggleContainer.classList.add('switch-on');
        } else {
            countySelectContainer.classList.add('hidden');
            toggleContainer.classList.remove('switch-on');
        }

        // Select the counties in the dropdown
        for (let option of countySelect.options) {
            option.selected = boundaries.selectedCounties.includes(option.value);
        }
    } else {
        toggleCounties.checked = false;
        countySelectContainer.classList.add('hidden');
        toggleContainer.classList.remove('switch-on');
        countySelect.selectedIndex = -1;
    }
}

/**
 * Load and render the list of all maps
 */
async function loadMapsList() {
    try {
        // Show loading state
        loadingList.classList.remove('hidden');
        mapsList.innerHTML = '';
        emptyState.classList.add('hidden');

        // Fetch maps from database
        const maps = await getAllMaps();

        // Hide loading
        loadingList.classList.add('hidden');

        if (maps.length === 0) {
            // Show empty state
            emptyState.classList.remove('hidden');
        } else {
            // Render map cards
            renderMapList(maps);
        }
    } catch (error) {
        loadingList.classList.add('hidden');
        const dialog = document.getElementById('dialog-error');
        const message = document.getElementById('error-message');
        message.textContent = 'Error loading maps: ' + error.message;
        dialog.open = true;
    }
}

/**
 * Handle search input to filter maps
 */
function handleSearch() {
    const searchTerm = mapSearch.value.toLowerCase().trim();
    const mapCards = document.querySelectorAll('.map-card');

    mapCards.forEach(card => {
        const mapName = card.querySelector('h3').textContent.toLowerCase();
        const mapNote = (card.dataset.note || '').toLowerCase();

        // Search in both name and note
        if (mapName.includes(searchTerm) || mapNote.includes(searchTerm)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });

    // Show empty state if no visible cards
    const visibleCards = Array.from(mapCards).filter(card => card.style.display !== 'none');
    if (visibleCards.length === 0 && searchTerm !== '') {
        emptyState.classList.remove('hidden');
        emptyState.querySelector('p').textContent = 'No maps match your search.';
    } else {
        emptyState.classList.add('hidden');
        emptyState.querySelector('p').textContent = 'No maps yet. Create your first map!';
    }
}

/**
 * Render the list of maps as cards
 * @param {Array} maps - Array of map objects
 */
function renderMapList(maps) {
    mapsList.innerHTML = '';

    maps.forEach(mapData => {
        const card = document.createElement('div');
        card.className = 'map-card';
        card.dataset.note = mapData.note || '';
        card.dataset.id = mapData.id;

        const updatedDate = new Date(mapData.updated_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        card.innerHTML = `
            <h3>${escapeHtml(mapData.name)}</h3>
            <div class="map-card-meta">Last updated: ${updatedDate}</div>
            <div class="map-card-actions">
                <button class="btn-primary btn-note" data-id="${mapData.id}" data-note="${escapeHtml(mapData.note || '')}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                    <span class="tooltip">Add a note</span>
                </button>
                <button class="btn-primary btn-copy-link" data-id="${mapData.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                    </svg>
                    <span class="tooltip">Copy map link</span>
                </button>
                <button class="btn-primary btn-copy" data-id="${mapData.id}" data-name="${escapeHtml(mapData.name)}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                    </svg>
                    <span class="tooltip">Clone this map</span>
                </button>
                <button class="btn-danger btn-delete" data-id="${mapData.id}" data-name="${escapeHtml(mapData.name)}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    <span class="tooltip">Delete this map</span>
                </button>
            </div>
        `;

        mapsList.appendChild(card);
    });

    // Attach event listeners to cards (to open map when clicking on card but not buttons)
    document.querySelectorAll('.map-card').forEach(card => {
        card.addEventListener('click', (e) => {
            // Only open map if clicking on the card itself, not buttons
            if (e.target.closest('.map-card-actions')) return;
            handleOpenMap(card.dataset.id);
        });
    });

    // Attach event listeners to buttons
    document.querySelectorAll('.btn-note').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleAddNote(btn.dataset.id, btn.dataset.note);
        });
    });

    document.querySelectorAll('.btn-copy-link').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleCopyLink(btn.dataset.id);
        });
    });

    document.querySelectorAll('.btn-copy').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleCopyMap(btn.dataset.id, btn.dataset.name);
        });
    });

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteMap(btn.dataset.id, btn.dataset.name);
        });
    });
}

/**
 * Load an existing map into the editor
 * @param {string} mapId - UUID of the map to load
 */
async function loadExistingMap(mapId) {
    try {
        loadingEditor.classList.remove('hidden');

        // Fetch map data
        const mapData = await getMapById(mapId);

        // Set map name
        mapNameInput.value = mapData.name;

        // Initialize map with saved state
        map = initializeMap('map-container', mapData.map_state);

        // Restore pins, boundaries, and enable features after map loads
        map.on('load', async () => {
            // Resize to ensure proper dimensions
            requestAnimationFrame(() => {
                map.resize();
            });

            // Enable pin placement
            enablePinPlacement(map);

            // Restore pins from saved state (handle both old and new format)
            if (mapData.map_state.salePins || mapData.map_state.rentPins || mapData.map_state.landPins) {
                restorePins(map, mapData.map_state);
            } else if (mapData.map_state.pins && mapData.map_state.pins.length > 0) {
                // Backwards compatibility: convert old pins format to sales pins
                restorePins(map, { salePins: mapData.map_state.pins, rentPins: [], landPins: [] });
            }

            // Restore the selected comp type and filter pins accordingly
            const savedCompType = mapData.map_state.currentCompType || 'sales';
            compTypeRadioGroup.value = savedCompType;
            switchCompType(map, savedCompType);

            // Restore county boundaries
            if (mapData.map_state.countyBoundaries) {
                await restoreCountyBoundaries(map, mapData.map_state.countyBoundaries);
            }

            // Setup UI controls
            setupMapControls();

            // Initialize geocoder
            initializeGeocoder();

            // Store the relevant saved state for comparison later (only pins and counties)
            lastSavedState = JSON.stringify(getRelevantMapState(map));

            loadingEditor.classList.add('hidden');
        });
    } catch (error) {
        loadingEditor.classList.add('hidden');
        const dialog = document.getElementById('dialog-error');
        const message = document.getElementById('error-message');
        message.textContent = 'Error loading map: ' + error.message;
        dialog.open = true;

        // Return to list view after dialog closes
        dialog.addEventListener('wa-hide', () => {
            showListView();
        }, { once: true });
    }
}

/**
 * Handle creating a new map
 */
function handleCreateNew() {
    const dialog = document.getElementById('dialog-create-map');
    const input = document.getElementById('new-map-name-input');
    const confirmBtn = document.getElementById('confirm-create-map');

    // Clear previous input
    input.value = '';

    // Show dialog
    dialog.open = true;

    // Focus input after dialog opens
    setTimeout(() => input.focus(), 100);

    // Handle confirm button click
    const handleConfirm = () => {
        const mapName = input.value.trim();

        if (!mapName) {
            // Could add validation styling here
            input.style.borderColor = '#e41a1c';
            return;
        }

        // Reset styling
        input.style.borderColor = '#d1d5db';

        // Close dialog
        dialog.open = false;

        // Create the map
        showEditorView(null, mapName);

        // Remove listener
        confirmBtn.removeEventListener('click', handleConfirm);
    };

    // Add listener
    confirmBtn.addEventListener('click', handleConfirm);

    // Handle Enter key in input
    const handleEnter = (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    };
    input.addEventListener('keypress', handleEnter);

    // Clean up on dialog close
    dialog.addEventListener('wa-hide', () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        input.removeEventListener('keypress', handleEnter);
        input.style.borderColor = '#d1d5db';
    }, { once: true });
}

/**
 * Handle opening an existing map
 * @param {string} id - UUID of the map to open
 */
function handleOpenMap(id) {
    showEditorView(id);
}

/**
 * Handle adding/editing a note for a map
 * @param {string} id - UUID of the map
 * @param {string} currentNote - Current note text
 */
async function handleAddNote(id, currentNote) {
    const dialog = document.getElementById('dialog-add-note');
    const textarea = document.getElementById('note-textarea');
    const confirmBtn = document.getElementById('confirm-save-note');

    // Set current note value
    textarea.value = currentNote || '';

    // Show dialog
    dialog.open = true;

    // Focus textarea after dialog opens
    setTimeout(() => textarea.focus(), 100);

    // Handle confirm button click
    const handleConfirm = async () => {
        const newNote = textarea.value.trim();

        // Close dialog
        dialog.open = false;

        try {
            // Update the note in the database
            await updateMapNote(id, newNote);

            // Reload the map list to show updated note
            await loadMapsList();
        } catch (error) {
            const errorDialog = document.getElementById('dialog-error');
            const errorMessage = document.getElementById('error-message');
            errorMessage.textContent = 'Error saving note: ' + error.message;
            errorDialog.open = true;
        }

        // Remove listener
        confirmBtn.removeEventListener('click', handleConfirm);
    };

    // Add listener
    confirmBtn.addEventListener('click', handleConfirm);

    // Clean up on dialog close
    dialog.addEventListener('wa-hide', () => {
        confirmBtn.removeEventListener('click', handleConfirm);
    }, { once: true });
}

/**
 * Handle copying map link to clipboard
 * @param {string} id - UUID of the map
 */
async function handleCopyLink(id) {
    try {
        const baseUrl = window.location.origin + window.location.pathname;
        const mapUrl = `${baseUrl}#map/${id}`;

        // Copy to clipboard
        await navigator.clipboard.writeText(mapUrl);

        // Show success message
        const dialog = document.getElementById('dialog-success');
        const message = document.getElementById('success-message');
        message.textContent = 'Map link copied to clipboard!';
        dialog.open = true;

        // Auto-close after 1.5 seconds
        setTimeout(() => {
            dialog.open = false;
        }, 1500);
    } catch (error) {
        const errorDialog = document.getElementById('dialog-error');
        const errorMessage = document.getElementById('error-message');
        errorMessage.textContent = 'Error copying link: ' + error.message;
        errorDialog.open = true;
    }
}

/**
 * Handle copying/duplicating a map
 * @param {string} id - UUID of the map to copy
 * @param {string} originalName - Name of the original map
 */
async function handleCopyMap(id, originalName) {
    const dialog = document.getElementById('dialog-copy-map');
    const input = document.getElementById('copy-map-name-input');
    const confirmBtn = document.getElementById('confirm-copy-map');

    // Set input value
    input.value = originalName + ' (Copy)';

    // Show dialog
    dialog.open = true;

    // Focus input after dialog opens
    setTimeout(() => input.focus(), 100);

    // Handle confirm button click
    const handleConfirm = async () => {
        const newName = input.value.trim();

        if (!newName) {
            input.style.borderColor = '#e41a1c';
            return;
        }

        // Reset styling
        input.style.borderColor = '#d1d5db';

        // Close dialog
        dialog.open = false;

        try {
            // Fetch the original map data
            const originalMap = await getMapById(id);

            // Create a new map with the same map_state but new name
            await createMap(newName, originalMap.map_state);

            // Clear search box and reload the map list
            mapSearch.value = '';
            await loadMapsList();

            // Show success message
            const successDialog = document.getElementById('dialog-success');
            const successMessage = document.getElementById('success-message');
            successMessage.textContent = `"${newName}" has been created`;
            successDialog.open = true;

            // Auto-close after 2 seconds
            setTimeout(() => {
                successDialog.open = false;
            }, 2000);
        } catch (error) {
            const errorDialog = document.getElementById('dialog-error');
            const errorMessage = document.getElementById('error-message');
            errorMessage.textContent = 'Error copying map: ' + error.message;
            errorDialog.open = true;
        }

        // Remove listener
        cleanup();
    };

    // Cleanup function
    const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        input.removeEventListener('keypress', handleEnter);
        input.style.borderColor = '#d1d5db';
    };

    // Handle Enter key in input
    const handleEnter = (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    };

    // Add listeners
    confirmBtn.addEventListener('click', handleConfirm);
    input.addEventListener('keypress', handleEnter);

    // Clean up on dialog close
    dialog.addEventListener('wa-hide', cleanup, { once: true });
}

/**
 * Handle deleting a map
 * @param {string} id - UUID of the map to delete
 * @param {string} name - Name of the map (for confirmation)
 */
async function handleDeleteMap(id, name) {
    const dialog = document.getElementById('dialog-delete-map');
    const message = document.getElementById('delete-map-message');
    const confirmBtn = document.getElementById('confirm-delete-map');

    // Set message
    message.textContent = `Are you sure you want to delete "${name}"?`;

    // Show dialog
    dialog.open = true;

    // Handle confirm button click
    const handleConfirm = async () => {
        dialog.open = false;

        try {
            await deleteMap(id);

            // Clear search box and reload list
            mapSearch.value = '';
            await loadMapsList();
        } catch (error) {
            const errorDialog = document.getElementById('dialog-error');
            const errorMessage = document.getElementById('error-message');
            errorMessage.textContent = 'Error deleting map: ' + error.message;
            errorDialog.open = true;
        }

        // Remove listener
        confirmBtn.removeEventListener('click', handleConfirm);
    };

    // Add listener
    confirmBtn.addEventListener('click', handleConfirm);

    // Clean up on dialog close
    dialog.addEventListener('wa-hide', () => {
        confirmBtn.removeEventListener('click', handleConfirm);
    }, { once: true });
}

/**
 * Handle saving the current map
 */
async function handleSave() {
    const name = mapNameInput.value.trim();

    if (!name) {
        const dialog = document.getElementById('dialog-warning');
        const message = document.getElementById('warning-message');
        message.textContent = 'Please enter a map name';
        dialog.open = true;

        // Focus the input after dialog closes
        dialog.addEventListener('wa-hide', () => {
            mapNameInput.focus();
        }, { once: true });
        return;
    }

    if (!map) {
        const dialog = document.getElementById('dialog-error');
        const message = document.getElementById('error-message');
        message.textContent = 'No map to save';
        dialog.open = true;
        return;
    }

    try {
        btnSave.disabled = true;

        const mapState = getMapState(map);

        if (currentMapId) {
            // Update existing map
            await updateMap(currentMapId, name, mapState);
        } else {
            // Create new map
            const newMap = await createMap(name, mapState);
            currentMapId = newMap.id;
            // Update URL now that we have a map ID
            updateUrl(currentMapId);
        }

        // Update last saved state (only relevant parts: pins and counties)
        lastSavedState = JSON.stringify(getRelevantMapState(map));

        btnSave.disabled = false;

        // Show success dialog
        const dialog = document.getElementById('dialog-map-saved');
        dialog.open = true;

        // Auto-close after 1.5 seconds
        setTimeout(() => {
            dialog.open = false;
        }, 1500);
    } catch (error) {
        btnSave.disabled = false;
        const dialog = document.getElementById('dialog-error');
        const message = document.getElementById('error-message');
        message.textContent = 'Error saving map: ' + error.message;
        dialog.open = true;
    }
}

/**
 * Handle saving as a new map (duplicate)
 * Note: This function is currently not used but kept for potential future use
 */
async function handleSaveAs() {
    const name = mapNameInput.value.trim();

    if (!name) {
        const dialog = document.getElementById('dialog-warning');
        const message = document.getElementById('warning-message');
        message.textContent = 'Please enter a map name';
        dialog.open = true;

        // Focus the input after dialog closes
        dialog.addEventListener('wa-hide', () => {
            mapNameInput.focus();
        }, { once: true });
        return;
    }

    if (!map) {
        const dialog = document.getElementById('dialog-error');
        const message = document.getElementById('error-message');
        message.textContent = 'No map to save';
        dialog.open = true;
        return;
    }

    // Use the copy dialog for Save As functionality
    const dialog = document.getElementById('dialog-copy-map');
    const input = document.getElementById('copy-map-name-input');
    const confirmBtn = document.getElementById('confirm-copy-map');

    // Set input value
    input.value = name + ' (Copy)';

    // Show dialog
    dialog.open = true;

    // Focus input after dialog opens
    setTimeout(() => input.focus(), 100);

    // Handle confirm button click
    const handleConfirm = async () => {
        const newName = input.value.trim();

        if (!newName) {
            input.style.borderColor = '#e41a1c';
            return;
        }

        // Reset styling
        input.style.borderColor = '#d1d5db';

        // Close dialog
        dialog.open = false;

        try {
            const mapState = getMapState(map);
            const newMap = await createMap(newName, mapState);

            // Switch to the newly created map
            currentMapId = newMap.id;
            mapNameInput.value = newMap.name;

            // Update URL to reflect the new map
            updateUrl(currentMapId);

            // Update last saved state (only relevant parts: pins and counties)
            lastSavedState = JSON.stringify(getRelevantMapState(map));

            // Show success message
            const successDialog = document.getElementById('dialog-success');
            const successMessage = document.getElementById('success-message');
            successMessage.textContent = 'Map saved successfully';
            successDialog.open = true;

            // Auto-close after 1.5 seconds
            setTimeout(() => {
                successDialog.open = false;
            }, 1500);
        } catch (error) {
            const errorDialog = document.getElementById('dialog-error');
            const errorMessage = document.getElementById('error-message');
            errorMessage.textContent = 'Error saving map: ' + error.message;
            errorDialog.open = true;
        }

        // Remove listener
        cleanup();
    };

    // Cleanup function
    const cleanup = () => {
        confirmBtn.removeEventListener('click', handleConfirm);
        input.removeEventListener('keypress', handleEnter);
        input.style.borderColor = '#d1d5db';
    };

    // Handle Enter key in input
    const handleEnter = (e) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    };

    // Add listeners
    confirmBtn.addEventListener('click', handleConfirm);
    input.addEventListener('keypress', handleEnter);

    // Clean up on dialog close
    dialog.addEventListener('wa-hide', cleanup, { once: true });
}

/**
 * Handle exporting the map as an image
 */
async function handleExportImage() {
    if (!map) {
        const dialog = document.getElementById('dialog-error');
        const message = document.getElementById('error-message');
        message.textContent = 'No map to export';
        dialog.open = true;
        return;
    }

    try {
        // Show loading indicator
        btnExportImage.disabled = true;
        btnExportImage.textContent = 'Exporting...';

        // Hide map controls and comp type controls during export
        const mapControls = document.getElementById('map-controls');
        const compTypeControls = document.getElementById('comp-type-controls');
        const originalMapControlsDisplay = mapControls.style.display;
        const originalCompTypeControlsDisplay = compTypeControls.style.display;
        mapControls.style.display = 'none';
        compTypeControls.style.display = 'none';

        // Wait for map to settle
        await new Promise(resolve => setTimeout(resolve, 100));

        // Use html2canvas to capture the entire map container including pins
        const mapContainer = document.getElementById('map-container');
        const canvas = await html2canvas(mapContainer, {
            useCORS: true,
            allowTaint: true,
            backgroundColor: null,
            scale: 2 // Higher quality export
        });

        // Restore controls
        mapControls.style.display = originalMapControlsDisplay;
        compTypeControls.style.display = originalCompTypeControlsDisplay;

        // Convert canvas to data URL (PNG format)
        const dataURL = canvas.toDataURL('image/png');

        // Create a temporary anchor element to trigger download
        const link = document.createElement('a');

        // Generate filename with map name and comp type
        const mapName = mapNameInput.value.trim() || 'map';
        const compType = map.userData.currentCompType || 'sales';
        const filename = `${mapName}-${compType}.png`;

        link.download = filename;
        link.href = dataURL;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Reset button
        btnExportImage.disabled = false;
        btnExportImage.textContent = 'Export Image';

        // Show success dialog
        const dialog = document.getElementById('dialog-export-success');
        const message = document.getElementById('export-success-message');
        message.textContent = `Map exported as ${filename}`;
        dialog.open = true;

        // Auto-close after 2 seconds
        setTimeout(() => {
            dialog.open = false;
        }, 2000);
    } catch (error) {
        console.error('Export error:', error);

        // Restore controls in case of error
        const mapControls = document.getElementById('map-controls');
        const compTypeControls = document.getElementById('comp-type-controls');
        mapControls.style.display = '';
        compTypeControls.style.display = '';

        // Reset button
        btnExportImage.disabled = false;
        btnExportImage.textContent = 'Export Image';

        const dialog = document.getElementById('dialog-error');
        const message = document.getElementById('error-message');
        message.textContent = 'Error exporting map: ' + error.message;
        dialog.open = true;
    }
}

/**
 * Get only the relevant parts of map state for change tracking
 * (pins and county boundaries, not map position)
 */
function getRelevantMapState(map) {
    if (!map || !map.userData) return null;

    return {
        salePins: map.userData.salePins || [],
        rentPins: map.userData.rentPins || [],
        landPins: map.userData.landPins || [],
        currentCompType: map.userData.currentCompType || 'sales',
        countyBoundaries: map.userData.countyBoundaries || { enabled: false, selectedCounties: [] }
    };
}

/**
 * Handle returning to the list view
 */
function handleBackToList() {
    if (map) {
        // Check if there are unsaved changes by comparing only pins and county boundaries
        const currentRelevantState = JSON.stringify(getRelevantMapState(map));
        const hasUnsavedChanges = currentRelevantState !== lastSavedState;

        if (hasUnsavedChanges) {
            const dialog = document.getElementById('dialog-unsaved-changes');
            const confirmBtn = document.getElementById('confirm-discard-changes');

            // Show dialog
            dialog.open = true;

            // Handle confirm button click
            const handleConfirm = () => {
                dialog.open = false;
                showListView();
                confirmBtn.removeEventListener('click', handleConfirm);
            };

            confirmBtn.addEventListener('click', handleConfirm);

            // Clean up on dialog close
            dialog.addEventListener('wa-hide', () => {
                confirmBtn.removeEventListener('click', handleConfirm);
            }, { once: true });
        } else {
            // No unsaved changes, go back directly
            showListView();
        }
    } else {
        showListView();
    }
}

/**
 * Escape HTML to prevent XSS
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Get map ID from URL hash
 * @returns {string|null} Map ID if present in URL, null otherwise
 */
function getMapIdFromUrl() {
    const hash = window.location.hash;
    if (hash.startsWith('#map/')) {
        return hash.substring(5); // Remove '#map/' prefix
    }
    return null;
}

/**
 * Update URL with map ID
 * @param {string|null} mapId - Map ID to set in URL, or null to clear
 */
function updateUrl(mapId) {
    if (mapId) {
        window.history.pushState(null, '', `#map/${mapId}`);
    } else {
        window.history.pushState(null, '', window.location.pathname);
    }
}


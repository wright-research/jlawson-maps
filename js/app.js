// Main application logic and UI state management

// Application state
let currentView = 'list'; // 'list' or 'editor'
let currentMapId = null;  // null for new map, UUID for existing
let map = null;           // Mapbox GL JS instance

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
const mapSearch = document.getElementById('map-search');

// Buttons
const btnNewMap = document.getElementById('btn-new-map');
const btnBack = document.getElementById('btn-back');
const btnExportImage = document.getElementById('btn-export-image');
const btnSave = document.getElementById('btn-save');
const btnSaveAs = document.getElementById('btn-save-as');

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
});

/**
 * Initialize the application
 */
async function initializeApp() {
    // Configure SweetAlert2 to disable animations
    const Toast = Swal.mixin({
        showClass: {
            popup: '',
            backdrop: ''
        },
        hideClass: {
            popup: '',
            backdrop: ''
        }
    });
    // Make it globally available
    window.Swal = Toast;

    // Attach event listeners
    btnNewMap.addEventListener('click', handleCreateNew);
    btnBack.addEventListener('click', handleBackToList);
    btnExportImage.addEventListener('click', handleExportImage);
    btnSave.addEventListener('click', handleSave);
    btnSaveAs.addEventListener('click', handleSaveAs);

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

    // Add basemap controls event listeners
    document.querySelectorAll('input[name="basemap"]').forEach(radio => {
        radio.addEventListener('change', handleBasemapChange);
    });

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
async function handleCountyToggle() {
    const enabled = toggleCounties.checked;

    // Show/hide county select dropdown
    if (enabled) {
        countySelectContainer.classList.remove('hidden');
    } else {
        countySelectContainer.classList.add('hidden');
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
 * Handle basemap change
 */
async function handleBasemapChange(event) {
    if (!map) return;

    const basemapType = event.target.value;
    await switchBasemap(map, basemapType);
}

/**
 * Show the list view and load all maps
 * @param {boolean} updateHistory - Whether to update browser history (default: true)
 */
async function showListView(updateHistory = true) {
    currentView = 'list';
    currentMapId = null;

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
        });
    }
}

/**
 * Setup map controls UI from current map state
 */
function setupMapControls() {
    if (!map || !map.userData) return;

    // Setup county controls
    const boundaries = map.userData.countyBoundaries;
    if (boundaries) {
        toggleCounties.checked = boundaries.enabled;

        // Show/hide county select based on enabled state
        if (boundaries.enabled) {
            countySelectContainer.classList.remove('hidden');
        } else {
            countySelectContainer.classList.add('hidden');
        }

        // Select the counties in the dropdown
        for (let option of countySelect.options) {
            option.selected = boundaries.selectedCounties.includes(option.value);
        }
    } else {
        toggleCounties.checked = false;
        countySelectContainer.classList.add('hidden');
        countySelect.selectedIndex = -1;
    }

    // Setup basemap controls
    const basemap = map.userData.basemap || 'street';
    const basemapRadio = document.querySelector(`input[name="basemap"][value="${basemap}"]`);
    if (basemapRadio) {
        basemapRadio.checked = true;
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
        Swal.fire({
            title: 'Error',
            text: 'Error loading maps: ' + error.message,
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
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
        if (mapName.includes(searchTerm)) {
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

        const updatedDate = new Date(mapData.updated_at).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'short',
            day: 'numeric'
        });

        card.innerHTML = `
            <h3>${escapeHtml(mapData.name)}</h3>
            <div class="map-card-meta">Last updated: ${updatedDate}</div>
            <div class="map-card-actions">
                <button class="btn-primary btn-open" data-id="${mapData.id}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10" />
                    </svg>
                    <span class="tooltip">Open</span>
                </button>
                <button class="btn-primary btn-copy" data-id="${mapData.id}" data-name="${escapeHtml(mapData.name)}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5a1.125 1.125 0 01-1.125-1.125v-1.5a3.375 3.375 0 00-3.375-3.375H9.75" />
                    </svg>
                    <span class="tooltip">Make a copy</span>
                </button>
                <button class="btn-danger btn-delete" data-id="${mapData.id}" data-name="${escapeHtml(mapData.name)}">
                    <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor">
                        <path stroke-linecap="round" stroke-linejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                    </svg>
                    <span class="tooltip">Delete</span>
                </button>
            </div>
        `;

        mapsList.appendChild(card);
    });

    // Attach event listeners to buttons
    document.querySelectorAll('.btn-open').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleOpenMap(btn.dataset.id);
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

            // Restore pins from saved state
            if (mapData.map_state.pins && mapData.map_state.pins.length > 0) {
                restorePins(map, mapData.map_state.pins);
            }

            // Restore county boundaries
            if (mapData.map_state.countyBoundaries) {
                await restoreCountyBoundaries(map, mapData.map_state.countyBoundaries);
            }

            // Setup UI controls
            setupMapControls();

            loadingEditor.classList.add('hidden');
        });
    } catch (error) {
        loadingEditor.classList.add('hidden');
        await Swal.fire({
            title: 'Error',
            text: 'Error loading map: ' + error.message,
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
        showListView();
    }
}

/**
 * Handle creating a new map
 */
async function handleCreateNew() {
    // Prompt for map name
    const { value: mapName } = await Swal.fire({
        title: 'Create New Map',
        input: 'text',
        inputLabel: 'Enter a name for your map',
        inputPlaceholder: 'My Map',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        cancelButtonColor: '#6b7280',
        inputValidator: (value) => {
            if (!value || !value.trim()) {
                return 'Please enter a map name';
            }
        }
    });

    // If user cancelled or didn't provide a name, don't create the map
    if (!mapName) {
        return;
    }

    // Create the map with the provided name
    showEditorView(null, mapName.trim());
}

/**
 * Handle opening an existing map
 * @param {string} id - UUID of the map to open
 */
function handleOpenMap(id) {
    showEditorView(id);
}

/**
 * Handle copying/duplicating a map
 * @param {string} id - UUID of the map to copy
 * @param {string} originalName - Name of the original map
 */
async function handleCopyMap(id, originalName) {
    try {
        // Prompt for new map name
        const { value: newName } = await Swal.fire({
            title: 'Copy Map',
            input: 'text',
            inputLabel: 'Enter a name for the new map',
            inputValue: originalName + ' (Copy)',
            showCancelButton: true,
            confirmButtonColor: '#2563eb',
            cancelButtonColor: '#6b7280',
            inputValidator: (value) => {
                if (!value || !value.trim()) {
                    return 'Please enter a map name';
                }
            }
        });

        // If user cancelled, return
        if (!newName) {
            return;
        }

        // Fetch the original map data
        const originalMap = await getMapById(id);

        // Create a new map with the same map_state but new name
        await createMap(newName.trim(), originalMap.map_state);

        // Clear search box and reload the map list
        mapSearch.value = '';
        await loadMapsList();

        // Show success message
        Swal.fire({
            title: 'Map Copied!',
            text: `"${newName.trim()}" has been created`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (error) {
        Swal.fire({
            title: 'Error',
            text: 'Error copying map: ' + error.message,
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
    }
}

/**
 * Handle deleting a map
 * @param {string} id - UUID of the map to delete
 * @param {string} name - Name of the map (for confirmation)
 */
async function handleDeleteMap(id, name) {
    const result = await Swal.fire({
        title: 'Delete Map?',
        text: `Are you sure you want to delete "${name}"?`,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'Yes, delete it',
        cancelButtonText: 'Cancel',
        confirmButtonColor: '#dc2626',
        cancelButtonColor: '#6b7280'
    });

    if (!result.isConfirmed) {
        return;
    }

    try {
        await deleteMap(id);

        // Clear search box and reload list
        mapSearch.value = '';
        await loadMapsList();
    } catch (error) {
        Swal.fire({
            title: 'Error',
            text: 'Error deleting map: ' + error.message,
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
    }
}

/**
 * Handle saving the current map
 */
async function handleSave() {
    const name = mapNameInput.value.trim();

    if (!name) {
        Swal.fire({
            title: 'Map Name Required',
            text: 'Please enter a map name',
            icon: 'warning',
            confirmButtonColor: '#2563eb'
        });
        mapNameInput.focus();
        return;
    }

    if (!map) {
        Swal.fire({
            title: 'No Map',
            text: 'No map to save',
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    try {
        btnSave.disabled = true;
        btnSave.textContent = 'Saving...';

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

        btnSave.textContent = 'Saved!';
        setTimeout(() => {
            btnSave.textContent = 'Save';
            btnSave.disabled = false;
        }, 1500);
    } catch (error) {
        btnSave.disabled = false;
        btnSave.textContent = 'Save';
        Swal.fire({
            title: 'Error',
            text: 'Error saving map: ' + error.message,
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
    }
}

/**
 * Handle saving as a new map (duplicate)
 */
async function handleSaveAs() {
    const name = mapNameInput.value.trim();

    if (!name) {
        Swal.fire({
            title: 'Map Name Required',
            text: 'Please enter a map name',
            icon: 'warning',
            confirmButtonColor: '#2563eb'
        });
        mapNameInput.focus();
        return;
    }

    if (!map) {
        Swal.fire({
            title: 'No Map',
            text: 'No map to save',
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    const { value: newName } = await Swal.fire({
        title: 'Save As',
        input: 'text',
        inputLabel: 'Enter a name for the new map',
        inputValue: name + ' (Copy)',
        showCancelButton: true,
        confirmButtonColor: '#2563eb',
        inputValidator: (value) => {
            if (!value || !value.trim()) {
                return 'Please enter a name';
            }
        }
    });

    if (!newName) {
        return;
    }

    try {
        btnSaveAs.disabled = true;
        btnSaveAs.textContent = 'Saving...';

        const mapState = getMapState(map);
        const newMap = await createMap(newName.trim(), mapState);

        // Switch to the newly created map
        currentMapId = newMap.id;
        mapNameInput.value = newMap.name;

        // Update URL to reflect the new map
        updateUrl(currentMapId);

        btnSaveAs.textContent = 'Saved!';
        setTimeout(() => {
            btnSaveAs.textContent = 'Save As';
            btnSaveAs.disabled = false;
        }, 1500);
    } catch (error) {
        btnSaveAs.disabled = false;
        btnSaveAs.textContent = 'Save As';
        Swal.fire({
            title: 'Error',
            text: 'Error saving map: ' + error.message,
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
    }
}

/**
 * Handle exporting the map as an image
 */
async function handleExportImage() {
    if (!map) {
        Swal.fire({
            title: 'No Map',
            text: 'No map to export',
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
        return;
    }

    try {
        // Show loading indicator
        btnExportImage.disabled = true;
        btnExportImage.textContent = 'Exporting...';

        // Hide map controls during export
        const mapControls = document.getElementById('map-controls');
        const basemapControls = document.getElementById('basemap-controls');
        const originalMapControlsDisplay = mapControls.style.display;
        const originalBasemapControlsDisplay = basemapControls.style.display;
        mapControls.style.display = 'none';
        basemapControls.style.display = 'none';

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
        basemapControls.style.display = originalBasemapControlsDisplay;

        // Convert canvas to data URL (PNG format)
        const dataURL = canvas.toDataURL('image/png');

        // Create a temporary anchor element to trigger download
        const link = document.createElement('a');

        // Generate filename with map name and timestamp
        const mapName = mapNameInput.value.trim() || 'map';
        const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
        const filename = `${mapName}_${timestamp}.png`;

        link.download = filename;
        link.href = dataURL;

        // Trigger download
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        // Reset button
        btnExportImage.disabled = false;
        btnExportImage.textContent = 'Export Image';

        // Show success message
        Swal.fire({
            title: 'Exported!',
            text: `Map exported as ${filename}`,
            icon: 'success',
            timer: 2000,
            showConfirmButton: false
        });
    } catch (error) {
        console.error('Export error:', error);

        // Reset button
        btnExportImage.disabled = false;
        btnExportImage.textContent = 'Export Image';

        Swal.fire({
            title: 'Error',
            text: 'Error exporting map: ' + error.message,
            icon: 'error',
            confirmButtonColor: '#2563eb'
        });
    }
}

/**
 * Handle returning to the list view
 */
async function handleBackToList() {
    if (map) {
        // Check if there are unsaved changes
        const result = await Swal.fire({
            title: 'Unsaved Changes',
            text: 'Any unsaved changes will be lost. Are you sure you want to go back?',
            icon: 'warning',
            showCancelButton: true,
            confirmButtonText: 'Yes, go back',
            cancelButtonText: 'Stay here',
            confirmButtonColor: '#dc2626',
            cancelButtonColor: '#6b7280'
        });

        if (result.isConfirmed) {
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


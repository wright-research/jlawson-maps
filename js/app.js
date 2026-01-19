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

// Buttons
const btnNewMap = document.getElementById('btn-new-map');
const btnBack = document.getElementById('btn-back');
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
    // Attach event listeners
    btnNewMap.addEventListener('click', handleCreateNew);
    btnBack.addEventListener('click', handleBackToList);
    btnSave.addEventListener('click', handleSave);
    btnSaveAs.addEventListener('click', handleSaveAs);

    // Add Enter key listener to map name input
    mapNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
        }
    });

    // Load and display map list
    await showListView();
}

/**
 * Show the list view and load all maps
 */
async function showListView() {
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

    // Load maps
    await loadMapsList();
}

/**
 * Show the editor view
 * @param {string|null} mapId - UUID of map to load, or null for new map
 */
async function showEditorView(mapId = null) {
    currentView = 'editor';
    currentMapId = mapId;

    // Switch views
    listView.classList.add('hidden');
    editorView.classList.remove('hidden');

    if (mapId) {
        // Load existing map
        await loadExistingMap(mapId);
    } else {
        // Create new map with defaults
        mapNameInput.value = 'Untitled Map';
        map = initializeMap('map-container');

        // Ensure map resizes to fill container after loading
        map.on('load', () => {
            map.resize();
        });
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
        alert('Error loading maps: ' + error.message);
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
                <button class="btn-primary btn-open" data-id="${mapData.id}">Open</button>
                <button class="btn-danger btn-delete" data-id="${mapData.id}">Delete</button>
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

    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            handleDeleteMap(btn.dataset.id, btn.closest('.map-card').querySelector('h3').textContent);
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

        // Ensure map resizes to fill container after loading
        map.on('load', () => {
            map.resize();
            loadingEditor.classList.add('hidden');
        });
    } catch (error) {
        loadingEditor.classList.add('hidden');
        alert('Error loading map: ' + error.message);
        showListView();
    }
}

/**
 * Handle creating a new map
 */
function handleCreateNew() {
    showEditorView(null);
}

/**
 * Handle opening an existing map
 * @param {string} id - UUID of the map to open
 */
function handleOpenMap(id) {
    showEditorView(id);
}

/**
 * Handle deleting a map
 * @param {string} id - UUID of the map to delete
 * @param {string} name - Name of the map (for confirmation)
 */
async function handleDeleteMap(id, name) {
    if (!confirm(`Are you sure you want to delete "${name}"?`)) {
        return;
    }

    try {
        await deleteMap(id);
        await loadMapsList();
    } catch (error) {
        alert('Error deleting map: ' + error.message);
    }
}

/**
 * Handle saving the current map
 */
async function handleSave() {
    const name = mapNameInput.value.trim();

    if (!name) {
        alert('Please enter a map name');
        mapNameInput.focus();
        return;
    }

    if (!map) {
        alert('No map to save');
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
        }

        btnSave.textContent = 'Saved!';
        setTimeout(() => {
            btnSave.textContent = 'Save';
            btnSave.disabled = false;
        }, 1500);
    } catch (error) {
        btnSave.disabled = false;
        btnSave.textContent = 'Save';
        alert('Error saving map: ' + error.message);
    }
}

/**
 * Handle saving as a new map (duplicate)
 */
async function handleSaveAs() {
    const name = mapNameInput.value.trim();

    if (!name) {
        alert('Please enter a map name');
        mapNameInput.focus();
        return;
    }

    if (!map) {
        alert('No map to save');
        return;
    }

    const newName = prompt('Enter a name for the new map:', name + ' (Copy)');

    if (!newName || !newName.trim()) {
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

        btnSaveAs.textContent = 'Saved!';
        setTimeout(() => {
            btnSaveAs.textContent = 'Save As';
            btnSaveAs.disabled = false;
        }, 1500);
    } catch (error) {
        btnSaveAs.disabled = false;
        btnSaveAs.textContent = 'Save As';
        alert('Error saving map: ' + error.message);
    }
}

/**
 * Handle returning to the list view
 */
function handleBackToList() {
    if (currentMapId === null && map) {
        // Unsaved new map
        if (confirm('You have unsaved changes. Are you sure you want to go back?')) {
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

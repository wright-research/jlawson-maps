// Supabase client initialization and database operations

// Initialize Supabase client
const supabase = window.supabase.createClient(
    CONFIG.SUPABASE_URL,
    CONFIG.SUPABASE_ANON_KEY
);

/**
 * Get all saved maps from the database
 * @returns {Promise<Array>} Array of map objects with id, name, created_at, updated_at
 */
async function getAllMaps() {
    try {
        const { data, error } = await supabase
            .from('maps')
            .select('id, name, created_at, updated_at')
            .order('updated_at', { ascending: false });

        if (error) throw error;
        return data || [];
    } catch (error) {
        console.error('Error fetching maps:', error);
        throw error;
    }
}

/**
 * Get a single map by ID
 * @param {string} id - UUID of the map
 * @returns {Promise<Object>} Map object with full map_state
 */
async function getMapById(id) {
    try {
        const { data, error } = await supabase
            .from('maps')
            .select('*')
            .eq('id', id)
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error fetching map:', error);
        throw error;
    }
}

/**
 * Create a new map in the database
 * @param {string} name - Name of the map
 * @param {Object} mapState - Map state object (center, zoom, bearing, pitch, style)
 * @returns {Promise<Object>} Created map object
 */
async function createMap(name, mapState) {
    try {
        const { data, error } = await supabase
            .from('maps')
            .insert([
                {
                    name: name,
                    map_state: mapState
                }
            ])
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error creating map:', error);
        throw error;
    }
}

/**
 * Update an existing map
 * @param {string} id - UUID of the map to update
 * @param {string} name - Updated name
 * @param {Object} mapState - Updated map state
 * @returns {Promise<Object>} Updated map object
 */
async function updateMap(id, name, mapState) {
    try {
        const { data, error } = await supabase
            .from('maps')
            .update({
                name: name,
                map_state: mapState
            })
            .eq('id', id)
            .select()
            .single();

        if (error) throw error;
        return data;
    } catch (error) {
        console.error('Error updating map:', error);
        throw error;
    }
}

/**
 * Delete a map from the database
 * @param {string} id - UUID of the map to delete
 * @returns {Promise<void>}
 */
async function deleteMap(id) {
    try {
        const { error } = await supabase
            .from('maps')
            .delete()
            .eq('id', id);

        if (error) throw error;
    } catch (error) {
        console.error('Error deleting map:', error);
        throw error;
    }
}

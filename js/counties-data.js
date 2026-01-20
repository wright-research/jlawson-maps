// Georgia counties we support
const GEORGIA_COUNTIES = [
    'Hall',
    'Habersham',
    'White',
    'Jackson',
    'Forsyth',
    'Barrow',
    'Stephens',
    'Gwinnett',
    'Banks',
    'Dawson',
    'Lumpkin',
    'Rabun',
    'Towns',
    'Union'
];

/**
 * Fetch Georgia county boundaries GeoJSON from local files
 * @param {Array<string>} countyNames - Array of county names to fetch
 * @returns {Promise<Object>} Combined GeoJSON with only the requested Georgia counties
 */
async function fetchGeorgiaCounties(countyNames = []) {
    try {
        const features = [];

        // Load each requested county's GeoJSON file
        for (const countyName of countyNames) {
            try {
                const response = await fetch(`data/counties/${countyName}.geojson`);
                if (!response.ok) {
                    console.warn(`Could not load ${countyName}.geojson`);
                    continue;
                }
                const geojson = await response.json();

                // Add all features from this county file
                if (geojson.features && Array.isArray(geojson.features)) {
                    features.push(...geojson.features);
                } else if (geojson.type === 'Feature') {
                    // Single feature
                    features.push(geojson);
                }
            } catch (err) {
                console.error(`Error loading ${countyName}:`, err);
            }
        }

        return {
            type: 'FeatureCollection',
            features: features
        };
    } catch (error) {
        console.error('Error fetching county data:', error);
        throw error;
    }
}

/**
 * Get list of available county names
 * @returns {Array<string>} Array of county names
 */
function getAvailableCounties() {
    return [...GEORGIA_COUNTIES].sort();
}

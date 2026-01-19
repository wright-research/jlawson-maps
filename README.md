# Map Templates

A simple web application for creating, saving, and managing map templates using Mapbox GL JS and Supabase.

## Features

- Create and save custom map configurations (center, zoom, bearing, pitch)
- Manage multiple saved maps
- Edit and update existing maps
- Delete maps
- Duplicate maps with "Save As"
- Fully static - no backend server required
- Hosted on GitHub Pages

## Tech Stack

- **Frontend**: Vanilla JavaScript, HTML, CSS
- **Mapping**: Mapbox GL JS
- **Database**: Supabase (PostgreSQL)
- **Hosting**: GitHub Pages

## Prerequisites

Before running this application, you need:

1. A Supabase account and project
2. A Mapbox account and access token
3. Git installed on your computer

## Setup Instructions

### 1. Supabase Database Setup

The database table has already been created in your Supabase project with the following structure:

```sql
CREATE TABLE maps (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    map_state JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

If you need to set it up again, run this SQL in your Supabase Dashboard (SQL Editor):

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

-- Enable RLS
ALTER TABLE maps ENABLE ROW LEVEL SECURITY;

-- Allow all operations (adjust for production with authentication)
CREATE POLICY "Allow all operations" ON maps
    FOR ALL
    USING (true)
    WITH CHECK (true);
```

### 2. Configuration

The application is already configured with your credentials in `js/config.js`:

- **Supabase URL**: `https://mrhixuyqchtrjtqdchcm.supabase.co`
- **Supabase Anon Key**: Configured
- **Mapbox Token**: Configured and restricted to your GitHub Pages URL

### 3. Local Development

To test the application locally:

#### Option 1: Using Python
```bash
python3 -m http.server 8000
```
Then open http://localhost:8000 in your browser.

#### Option 2: Using Node.js
```bash
npx http-server -p 8000
```

#### Option 3: Using VS Code Live Server
1. Install the "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

## Deployment to GitHub Pages

### Initial Setup

1. **Create GitHub Repository** (if not already done):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/jlawson-maps.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Source", select **Deploy from a branch**
   - Select **main** branch and **/ (root)** folder
   - Click **Save**
   - Wait 1-2 minutes for deployment

3. **Access Your App**:
   Your app will be live at: `https://YOUR-USERNAME.github.io/jlawson-maps/`

### Updating the App

After making changes:

```bash
git add .
git commit -m "Description of changes"
git push origin main
```

GitHub Pages will automatically rebuild and deploy your changes (takes about 30 seconds).

## Usage

### Creating a New Map

1. Click the **"+ New Map"** button
2. Use the map controls to navigate to your desired location
3. Adjust zoom, bearing, and pitch as needed
4. Enter a name for your map
5. Click **"Save"**

### Opening an Existing Map

1. From the list view, click **"Open"** on any map card
2. The map will load with your saved configuration

### Editing a Map

1. Open the map
2. Make changes to the map view (pan, zoom, rotate, etc.)
3. Click **"Save"** to update the existing map
4. Or click **"Save As"** to create a new copy with a different name

### Deleting a Map

1. From the list view, click **"Delete"** on any map card
2. Confirm the deletion

## Project Structure

```
map-templates/
├── index.html          # Main entry point
├── css/
│   └── styles.css      # All styles
├── js/
│   ├── config.js       # Supabase and Mapbox credentials
│   ├── supabase.js     # Database operations
│   ├── map.js          # Mapbox GL JS initialization and controls
│   └── app.js          # Main application logic
└── README.md           # This file
```

## Security Notes

- The Supabase anon key is safe to expose in frontend code
- Security is enforced via Row Level Security (RLS) policies in PostgreSQL
- The Mapbox token is restricted to your GitHub Pages URL
- For production with user authentication, update the RLS policies in Supabase

## Browser Support

This application requires a modern browser with support for:
- ES6+ JavaScript
- WebGL (for Mapbox GL JS)
- CSS Grid

Recommended browsers:
- Chrome/Edge 80+
- Firefox 75+
- Safari 13+

## Troubleshooting

### Maps not loading?
- Check browser console for errors
- Verify Supabase credentials in `js/config.js`
- Ensure Supabase RLS policies are set up correctly

### Mapbox map not displaying?
- Verify Mapbox token in `js/config.js`
- Check that the token is not expired
- Ensure URL restrictions on the token include your domain

### GitHub Pages not updating?
- Wait 1-2 minutes after pushing
- Check the Pages deployment status in your repository's Actions tab
- Clear your browser cache

## Future Enhancements

Potential features to add:

- User authentication via Supabase Auth
- Add markers, polygons, and lines to maps
- Map thumbnails in list view
- Export maps as images
- Share maps via public URLs
- Multiple basemap style options
- Search functionality for saved maps

## License

This project is open source and available for personal and commercial use.

## Support

For issues or questions, please open an issue in the GitHub repository.

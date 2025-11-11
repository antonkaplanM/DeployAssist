# Tailwind CSS Setup

## Overview

This project now uses Tailwind CSS v3 as a production-ready dependency instead of the CDN version.

## What Changed

### Before
- Used `https://cdn.tailwindcss.com` (not production-ready)
- Inline configuration in HTML
- Browser warning in console

### After
- Tailwind CSS v3 installed as dev dependency
- Compiled CSS file: `public/tailwind.css`
- Configuration in `tailwind.config.js`
- Build scripts in `package.json`

## Files Created/Modified

### Created
- `tailwind.config.js` - Tailwind configuration with custom theme colors
- `src/input.css` - Source CSS file with Tailwind directives
- `public/tailwind.css` - Compiled CSS (git-ignored)

### Modified
- `public/index.html` - Removed CDN script, now uses compiled CSS
- `package.json` - Added build scripts
- `.gitignore` - Added compiled CSS to ignore list
- `README.md` - Added CSS build instructions

## Available Commands

```bash
# Build CSS for production (minified)
npm run build:css

# Watch CSS for development (auto-rebuild on changes)
npm run watch:css

# Start server (requires CSS to be built first)
npm start

# Build CSS and start server in one command
npm run dev
```

## Development Workflow

### First Time Setup
1. `npm install` - Install dependencies
2. `npm run build:css` - Build the CSS
3. `npm start` - Start the server

### During Development
Option 1: Manual rebuild
```bash
npm run build:css  # After making CSS changes
npm start
```

Option 2: Watch mode (recommended)
```bash
# Terminal 1
npm run watch:css  # Auto-rebuilds on changes

# Terminal 2
npm start         # Run the server
```

Option 3: Quick start
```bash
npm run dev       # Builds CSS and starts server
```

## Custom Theme

The Tailwind configuration includes custom colors matching the shadcn/ui design system:

- `background`, `foreground`
- `primary`, `secondary`
- `muted`, `accent`, `card`
- `border`, `input`, `ring`

All custom colors are configured in `tailwind.config.js`.

## Troubleshooting

### CSS not updating?
1. Make sure you ran `npm run build:css` after making changes
2. Clear browser cache (Ctrl+Shift+R or Cmd+Shift+R)
3. Check that `public/tailwind.css` file exists and has content

### Styles look broken?
1. Verify `public/tailwind.css` is properly linked in HTML
2. Make sure the compiled CSS file exists
3. Check browser console for 404 errors

### Build fails?
1. Ensure Tailwind CSS v3 is installed: `npm list tailwindcss`
2. Reinstall if needed: `npm install --save-dev tailwindcss@3`
3. Check that `src/input.css` exists

## Benefits

✅ **Production Ready**: No more CDN warnings  
✅ **Better Performance**: Minified CSS, faster load times  
✅ **Offline Development**: Works without internet  
✅ **Custom Configuration**: Full control over Tailwind settings  
✅ **Build Optimization**: Only includes used CSS classes  


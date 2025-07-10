# Shopify Admin File Sync Scripts

This directory contains scripts to sync Admin files (Content > Files) between Shopify stores.

## Scripts

### 1. `sync-files-direct.js`

The main sync script that copies files from production to staging using GraphQL API.

### 2. `complete-file-sync.js`

A wrapper script that runs the sync process and handles errors.

### 3. `debug-file-references.js`

Debug tool to check if specific files exist in staging and show their URLs.

## Setup

1. Install dependencies (if not already installed):

   ```bash
   cd scripts
   npm install
   ```

2. Set environment variables:
   ```bash
   export PRODUCTION_STORE="your-production-store.myshopify.com"
   export PRODUCTION_ACCESS_TOKEN="shpat_xxxxx"
   export STAGING_STORE="your-staging-store.myshopify.com"
   export STAGING_ACCESS_TOKEN="shpat_xxxxx"
   ```

## Usage

### Sync all files:

```bash
npm run sync
```

### Debug file references:

```bash
npm run debug
```

## Important Notes

- Files are synced with preserved filenames to maintain `shopify://` protocol references
- The sync creates copies of files, not references to the same file
- Each store maintains its own copy of the files

## Troubleshooting

### Images not appearing after sync

If images are synced but not appearing in your staging theme:

1. **Clear browser cache and refresh**

   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)
   - Try opening the theme editor in an incognito/private window

2. **Wait for CDN propagation**

   - Sometimes it takes a few minutes for files to propagate through Shopify's CDN
   - Wait 5-10 minutes and refresh again

3. **Verify files exist**

   - Run `npm run debug` to check if specific files exist in staging
   - Look for files like "Ocean.avif" or other images referenced in your theme

4. **Check theme references**

   - The `shopify://` protocol references (e.g., `shopify://shop_images/Ocean.avif`) should work automatically
   - These references look for files by filename, so exact filename matches are important
   - The sync script preserves original filenames to maintain compatibility

5. **Theme editor specific issues**
   - Sometimes the theme editor caches old file references
   - Try saving the theme, exiting the editor, and reopening it
   - You can also try duplicating the theme and checking the duplicate

### Understanding shopify:// protocol

The `shopify://` protocol is Shopify's way of referencing files across the platform:

- `shopify://shop_images/filename.ext` - References image files
- `shopify://files/filename.ext` - References generic files
- `shopify://videos/filename.ext` - References video files

These references work by filename matching, so:

- Files must have the exact same filename in both stores
- The protocol is case-sensitive
- Extensions must match exactly

## API Requirements

Both stores need access tokens with the following scopes:

- Production: `read_files`
- Staging: `write_files`

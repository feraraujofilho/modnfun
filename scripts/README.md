# Shopify Admin File Sync Scripts

This directory contains scripts to sync Admin files (Content > Files) between Shopify stores and automatically update theme references.

## Scripts

### 1. `sync-files-direct.js`

The main sync script that copies files from production to staging using GraphQL API.

### 2. `complete-file-sync.js`

A complete sync workflow that:

- Syncs files from production to staging
- Waits for file processing
- Automatically replaces `shopify://` URLs with direct CDN URLs in theme files

### 3. `replace-shopify-urls.js`

Scans all theme files and replaces `shopify://` protocol URLs with actual CDN URLs from staging.

### 4. `debug-file-references.js`

Debug tool to check if specific files exist in staging and show their URLs.

### 5. `get-file-urls.js`

Gets direct CDN URLs for specific files in staging.

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

### Complete sync with automatic URL replacement:

```bash
npm run complete-sync
```

This will:

1. Sync all files from production to staging
2. Wait for files to be processed
3. Replace all `shopify://` URLs in theme files with direct CDN URLs
4. You'll need to push the theme changes after

### Individual commands:

#### Sync files only:

```bash
npm run sync
```

#### Replace URLs only:

```bash
npm run replace-urls
```

#### Debug file references:

```bash
npm run debug
```

#### Get direct URLs:

```bash
npm run get-urls
```

## How URL Replacement Works

The `replace-shopify-urls.js` script:

1. **Scans theme directories**: `templates`, `sections`, `snippets`, `layout`, `config`
2. **Finds shopify:// references**: Like `"image": "shopify://shop_images/Ocean.avif"`
3. **Looks up files in staging**: Queries the staging store for each filename
4. **Replaces with CDN URLs**: Updates to `"image": "https://cdn.shopify.com/s/files/..."`
5. **Saves changes locally**: Modified files need to be pushed to Shopify

### Example transformation:

```json
// Before:
"image": "shopify://shop_images/Ocean.avif"

// After:
"image": "https://cdn.shopify.com/s/files/1/0XXX/XXXX/files/Ocean.avif"
```

## Important Notes

- Files are synced with preserved filenames to maintain compatibility
- URL replacement modifies theme files locally - you must push changes to Shopify
- The sync creates copies of files, not references to the same file
- Each store maintains its own copy of the files

## Troubleshooting

### Images not appearing after sync

If images are synced but not appearing in your staging theme:

1. **Run the complete sync**

   ```bash
   npm run complete-sync
   ```

2. **Push theme changes**

   ```bash
   cd ..
   shopify theme push
   ```

3. **Clear browser cache**
   - Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Windows/Linux)

### Understanding shopify:// protocol

The `shopify://` protocol is Shopify's way of referencing files:

- `shopify://shop_images/filename.ext` - References image files
- `shopify://files/filename.ext` - References generic files
- `shopify://videos/filename.ext` - References video files

These references work by filename matching, which can be unreliable when syncing between stores. That's why this tool replaces them with direct CDN URLs.

## API Requirements

Both stores need access tokens with the following scopes:

- Production: `read_files`
- Staging: `write_files`

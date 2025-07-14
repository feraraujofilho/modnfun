# Shopify Admin File Sync Scripts

This directory contains scripts to sync Admin files (Content > Files) between Shopify stores.

## Scripts

### `sync-files-direct.js`

The main sync script that copies files from production to staging using GraphQL API.

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

### Sync files:

```bash
npm run sync
```

This will sync all files from production to staging.

## Important Notes

- Files are synced with preserved filenames to maintain compatibility
- The sync creates copies of files, not references to the same file
- Each store maintains its own copy of the files

## API Requirements

Both stores need access tokens with the following scopes:

- Production: `read_files`
- Staging: `write_files`

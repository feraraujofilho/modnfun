# Theme Sync Scripts

This directory contains scripts for syncing theme files and assets between Shopify stores.

## Scripts

### sync-files-direct.js

Direct file sync between two Shopify stores. This script:

- Fetches all theme files from source store
- Compares with target store files
- Updates only changed files
- Preserves file structure and content

### sync-images-check.js

Image sync with duplicate detection. This script:

- Fetches all images from source store
- Checks for duplicates in target store before syncing
- Uses filename-based matching to avoid duplicating images with different URLs
- Provides detailed sync statistics

## Usage

### Direct File Sync

```bash
SOURCE_STORE="source.myshopify.com" \
SOURCE_ACCESS_TOKEN="your-source-token" \
TARGET_STORE="target.myshopify.com" \
TARGET_ACCESS_TOKEN="your-target-token" \
node sync-files-direct.js
```

### Image Sync

```bash
SOURCE_STORE="source.myshopify.com" \
SOURCE_ACCESS_TOKEN="your-source-token" \
TARGET_STORE="target.myshopify.com" \
TARGET_ACCESS_TOKEN="your-target-token" \
node sync-images-check.js
```

## Environment Variables

- `SOURCE_STORE`: Source Shopify store URL
- `SOURCE_ACCESS_TOKEN`: Admin API access token for source store
- `TARGET_STORE`: Target Shopify store URL
- `TARGET_ACCESS_TOKEN`: Admin API access token for target store

## Features

### Image Sync Features

- **Duplicate Detection**: Checks if images already exist before syncing
- **Smart Filename Matching**: Ignores size suffixes (e.g., \_1024x1024) when checking for duplicates
- **Batch Processing**: Handles large image libraries efficiently
- **Progress Tracking**: Real-time status updates during sync
- **Error Handling**: Continues sync even if individual images fail

## Output

Both scripts provide detailed output including:

- Number of files/images processed
- Success/skip/failure counts
- Specific error messages for failed items
- Summary statistics

For GitHub Actions integration, the scripts also output results in a format compatible with `GITHUB_OUTPUT`.

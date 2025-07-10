# Theme Sync Workflow Documentation

This repository uses GitHub Actions to automatically sync theme changes between Production, Staging, and Feature branches.

## Workflows

### 1. PR Theme Sync Workflow (`.github/workflows/pr-sync-check.yml`)

**Purpose**: Ensures theme synchronization between Production, Staging, and Feature branches.

**Triggers**:

- On every PR to staging or main branches
- Types: opened, synchronize, reopened

**What it does**:

1. Pulls the latest production theme
2. Updates the target branch (staging) with production changes
3. Checks for conflicts and handles them appropriately
4. Approves PRs when ready (but doesn't auto-merge)

### 2. Admin Files Sync Workflow (`.github/workflows/sync-admin-files.yml`)

**Purpose**: Syncs Admin files (Content > Files) from Production to Staging and updates theme references.

**Triggers**:

- Manual workflow dispatch
- Daily at 2 AM UTC (scheduled)

**What it does**:

1. Syncs all files from Production Admin to Staging Admin
2. Waits for Shopify to process the files
3. Replaces all `shopify://` protocol URLs with direct CDN URLs in theme files
4. Commits and pushes any theme changes
5. Pushes the updated theme to staging

**Why it's needed**: Files uploaded via Admin > Content > Files aren't synced with regular theme commands. This workflow ensures images and files referenced in themes work correctly in staging.

## How Theme Updates Work

### Feature → Staging PRs

1. Developer creates PR from feature branch to staging
2. Workflow pulls latest production theme
3. If conflicts exist, creates a sync PR that must be merged first
4. Once conflicts resolved, PR is approved

### Staging → Main PRs

1. Similar process but ensures staging has latest production changes
2. Helps maintain consistency across environments

### Admin Files Sync

1. Files are copied from production to staging daily
2. Theme files are automatically updated to use staging CDN URLs
3. Changes are committed and pushed automatically

## Required Secrets

### For Theme Sync

- `PRODUCTION_STORE`: Production store URL
- `PRODUCTION_THEME_ACCESS_PASSWORD`: Theme access token for production
- `SHOPIFY_FLAG_STORE`: Staging store URL
- `STAGING_THEME_ACCESS_PASSWORD`: Theme access token for staging

### For Admin Files Sync

- `PRODUCTION_ADMIN_API_TOKEN`: Admin API token with `read_files` scope
- `STAGING_ADMIN_API_TOKEN`: Admin API token with `write_files` scope

## Best Practices

1. **Always sync from production**: Production is the source of truth
2. **Resolve conflicts promptly**: Sync PRs block other updates
3. **Monitor file sync**: Check that images appear correctly after sync
4. **Review automated commits**: Check theme file changes from URL updates

## Troubleshooting

### Theme Sync Issues

- Check workflow logs for specific errors
- Ensure all secrets are correctly configured
- Verify theme access passwords are valid

### File Sync Issues

- Verify Admin API tokens have correct scopes
- Check that files exist in production before expecting them in staging
- Allow time for CDN propagation after sync

## Manual Sync

If needed, you can manually run syncs:

### Theme Sync

```bash
shopify theme pull --store=production-store.myshopify.com --live
shopify theme push --store=staging-store.myshopify.com --live
```

### Admin Files Sync

```bash
cd scripts
npm run complete-sync
cd ..
shopify theme push --live
```

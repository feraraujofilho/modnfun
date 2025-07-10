# Theme Sync Workflow Documentation

## Overview

This GitHub Action workflow ensures that theme changes in production are always synchronized to staging before any feature branches or staging changes are merged. This prevents accidental overwrites of production theme changes and maintains consistency across environments.

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    PR Theme Sync Workflow                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Feature → Staging PR:                                          │
│  1. Checkout staging branch                                     │
│  2. Pull production theme → staging                             │
│  3. If conflicts with production:                               │
│     → Create sync PR (production → staging)                     │
│     → Block feature PR                                          │
│  4. If no conflicts:                                           │
│     → Commit production changes to staging                      │
│     → Check feature conflicts with updated staging              │
│  5. If feature conflicts: Block PR                             │
│  6. If no conflicts: Approve PR                                │
│                                                                  │
│  Staging → Main PR:                                             │
│  1. Checkout staging branch                                     │
│  2. Pull production theme → staging                             │
│  3. If conflicts: Create sync PR & block                        │
│  4. If no conflicts: Update staging & approve PR                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Key Concepts

### 1. Production Theme as Source of Truth

- The production Shopify theme is always considered the source of truth
- Any changes made directly in production (via theme editor, apps, etc.) must be synced back
- Uses `shopify theme pull --live --force` to get the complete theme

### 2. Staging Branch as Integration Point

- Staging branch is always updated with production changes before merges
- This happens automatically when PRs are opened
- Ensures staging reflects the latest production state

### 3. Conflict Resolution Strategy

- **Simple conflicts**: Automatically resolved by the workflow
- **Complex conflicts**: Require manual intervention via a sync PR
- **No overwrites**: Changes from both sides are preserved

## Workflow Steps Explained

### Step 1: PR Type Detection

```yaml
# Determines if PR is:
# - feature → staging
# - staging → main
# - other (ignored)
```

### Step 2: Checkout Target Branch

- Always checks out staging branch (never main)
- This is where production changes will be applied

### Step 3: Pull Production Theme

```bash
shopify theme pull --live --force
```

- Downloads entire production theme
- Compares with current staging state
- Identifies all changed files

### Step 4: Handle Production Changes

#### If no production changes:

- Proceed to check feature conflicts

#### If production changes exist:

1. Attempt to commit and push to staging
2. If successful: Continue workflow
3. If conflicts: Create a sync PR

### Step 5: Create Sync PR (if needed)

- Creates a new branch: `sync-production-{timestamp}`
- Opens PR to staging with production changes
- Blocks original PR until sync is complete

### Step 6: Check Feature Conflicts

- Only for feature → staging PRs
- Simulates merge to detect conflicts
- Does not modify any branches

### Step 7: Update PR Status

- **Success**: Approves PR (no auto-merge)
- **Failure**: Blocks PR with detailed instructions
- **Comments**: Provides clear next steps

## Configuration Requirements

### 1. Repository Secrets

```yaml
PRODUCTION_STORE: your-store.myshopify.com
PRODUCTION_THEME_ACCESS_PASSWORD: shptka_xxxxx
```

### 2. Branch Protection Rules

- Staging branch should allow GitHub Actions to push
- Consider using a PAT for enhanced permissions

### 3. Workflow Permissions

```yaml
permissions:
  contents: write
  pull-requests: write
  statuses: write
  issues: write
```

## Common Scenarios

### Scenario 1: Clean Feature PR

1. Developer opens PR: `feature/add-banner` → `staging`
2. Workflow pulls production (no changes)
3. No conflicts detected
4. PR approved automatically

### Scenario 2: Production Has Changes

1. Developer opens PR: `feature/update-header` → `staging`
2. Workflow pulls production (finds changes)
3. Commits changes to staging
4. Checks feature conflicts
5. If clean: PR approved
6. If conflicts: Developer must resolve

### Scenario 3: Complex Production Conflicts

1. Developer opens PR: `feature/redesign` → `staging`
2. Workflow pulls production (major changes)
3. Cannot auto-merge to staging
4. Creates sync PR: `sync-production-123` → `staging`
5. Original PR blocked
6. Team resolves sync PR first
7. Re-run checks on original PR

## Troubleshooting

### "Production sync required" Error

**Solution**:

1. Check the linked sync PR
2. Review and merge it
3. Re-run workflow on your PR

### "Merge conflicts detected" Error

**Solution**:

```bash
git checkout your-feature-branch
git pull origin staging
# Resolve conflicts in your editor
git add .
git commit -m "Resolve conflicts with staging"
git push
```

### Workflow Not Triggering

**Check**:

- PR is targeting `staging` or `main`
- Workflow file is in default branch
- GitHub Actions are enabled

## Best Practices

1. **Always work from latest staging**

   ```bash
   git checkout staging
   git pull
   git checkout -b feature/new-feature
   ```

2. **Keep PRs focused**

   - Smaller PRs = fewer conflicts
   - Easier to review and merge

3. **Monitor production changes**

   - Check sync PRs regularly
   - Coordinate theme editor changes

4. **Test locally first**
   ```bash
   shopify theme pull --live --force
   git status  # Check what changed
   ```

## Advanced Configuration

### Custom Conflict Resolution

Add to workflow for auto-resolution of specific files:

```yaml
# Auto-resolve version conflicts
git checkout --theirs config/settings_data.json
git add config/settings_data.json
```

### Exclude Files from Sync

```yaml
# Add .shopifyignore file
config/settings_data.json
locales/*.json
```

### Notification Integration

```yaml
- name: Notify Slack
  if: failure()
  uses: 8398a7/action-slack@v3
  with:
    status: ${{ job.status }}
    text: "Theme sync failed! Check PR #${{ github.event.number }}"
```

## Security Considerations

1. **Token Permissions**

   - Use minimal required permissions
   - Rotate tokens regularly
   - Store in GitHub Secrets

2. **Branch Protection**

   - Require PR reviews
   - Enforce status checks
   - Restrict direct pushes

3. **Audit Trail**
   - All changes tracked in git
   - PR comments document decisions
   - Workflow logs available

## Maintenance

### Regular Tasks

- Review sync PR patterns
- Update Shopify CLI version
- Monitor workflow performance
- Clean up old sync branches

### Updating the Workflow

1. Test changes in a separate branch
2. Use workflow_dispatch for testing
3. Monitor first few runs closely
4. Document any new features

## FAQ

**Q: Why does staging get updated instead of the PR branch?**
A: This ensures all features are tested against the same production state.

**Q: Can I bypass the sync check?**
A: No, this would risk overwriting production changes.

**Q: What if multiple PRs need the same sync?**
A: The first PR creates the sync, others wait for it to complete.

**Q: How often should we sync manually?**
A: The workflow handles this automatically on each PR.

**Q: Can this work with multiple themes?**
A: Yes, but requires workflow modifications for theme selection.

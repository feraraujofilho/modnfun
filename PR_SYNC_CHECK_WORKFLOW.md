# PR Branch Sync Check Workflow Guide

This guide explains how the PR Branch Sync Check workflow operates to ensure proper Git branch synchronization between main and staging branches.

> **Note:** This workflow is purely Git-based and handles branch synchronization at the repository level. It is not related to theme syncing or deployment - it simply ensures that your staging branch stays up-to-date with main and checks for merge conflicts.

## Overview

The PR Branch Sync Check workflow (`pr-sync-check.yml`) is a GitHub Actions workflow that automatically runs on every pull request targeting staging or main branches. Its primary purpose is to:

1. **Keep staging synchronized with main** - Automatically merges main into staging when needed
2. **Detect merge conflicts early** - Checks for conflicts before attempting to merge
3. **Auto-approve conflict-free PRs** - Streamlines the review process when all checks pass

## Workflow Triggers

The workflow activates on:

- Pull request creation (`opened`)
- Pull request updates (`synchronize`)
- Pull request reopening (`reopened`)

Target branches:

- `staging`
- `main`

## Workflow Flow Diagram

```
┌─────────────────────────┐
│   PR Created/Updated    │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│   Analyze PR Type       │
│  - Feature → Staging    │
│  - Staging → Main       │
│  - Other (skip)         │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│  Fetch Latest Branches  │
│  - main                 │
│  - staging              │
│  - feature branch       │
└───────────┬─────────────┘
            │
            ▼
┌─────────────────────────┐
│ Check if Staging Behind │
│        Main             │
└───────────┬─────────────┘
            │
    ┌───────┴───────┐
    │               │
    ▼               ▼
┌─────────┐    ┌─────────────┐
│   No    │    │    Yes      │
│ Updates │    │ Merge Main  │
│ Needed  │    │ to Staging  │
└────┬────┘    └──────┬──────┘
     │                │
     │         ┌──────┴──────┐
     │         │             │
     │         ▼             ▼
     │    ┌─────────┐   ┌──────────┐
     │    │ Success │   │ Conflicts│
     │    │  Push   │   │ Detected │
     │    └────┬────┘   └─────┬────┘
     │         │              │
     └─────────┴──────────────┘
               │
               ▼
    ┌─────────────────────────┐
    │  Check Feature Branch   │
    │  Conflicts (if feature  │
    │  → staging PR)          │
    └───────────┬─────────────┘
                │
        ┌───────┴───────┐
        │               │
        ▼               ▼
    ┌─────────┐    ┌──────────┐
    │   No    │    │ Conflicts│
    │Conflicts│    │ Detected │
    └────┬────┘    └─────┬────┘
         │               │
         └───────┬───────┘
                 │
                 ▼
    ┌─────────────────────────┐
    │   Update PR Status      │
    │  - Add comment          │
    │  - Set commit status    │
    │  - Auto-approve if OK   │
    └─────────────────────────┘
```

## Detailed Step-by-Step Process

### Step 1: Repository Checkout and Git Configuration

- Checks out the repository with full history (`fetch-depth: 0`)
- Configures Git with a bot user for automated commits
- Uses `GITHUB_TOKEN` for authentication

### Step 2: PR Type Analysis

The workflow determines the PR type:

- **Feature → Staging**: Development branches merging into staging
- **Staging → Main**: Staging branch merging into production (main)
- **Other**: Any other PR type (workflow skips processing)

### Step 3: Branch Fetching

Fetches the latest state of all relevant branches:

- `main` (production)
- `staging`
- The PR's source branch (feature branch)

### Step 4: Staging Branch Synchronization

Checks if staging is behind main and handles synchronization:

**If staging is up-to-date:**

- Proceeds to conflict checking

**If staging is behind main:**

- Attempts to merge main into staging
- If successful: Pushes updated staging branch
- If conflicts: Records conflict details and aborts merge

### Step 5: Feature Branch Conflict Check

For feature → staging PRs only:

- Performs a dry-run merge of the feature branch into staging
- Identifies any conflicts without actually merging
- Records conflicting files if any exist

### Step 6: PR Status Update

Based on the results, the workflow:

**Updates commit status:**

- ✅ `success` - Ready to merge
- ❌ `failure` - Conflicts detected or update failed

**Posts/updates a comment with:**

- Current synchronization status
- Conflict information (if any)
- Instructions for conflict resolution
- Merge readiness status

**Auto-approves PR if:**

- No conflicts detected
- Staging is synchronized with main
- All checks pass

### Step 7: Workflow Summary

Generates a summary in GitHub Actions including:

- PR type and branches involved
- Whether staging needed updates
- Conflict detection results
- Overall merge readiness

## Common Scenarios

### Scenario 1: Clean Feature PR to Staging

1. Developer creates PR from `feature/new-feature` to `staging`
2. Workflow runs and finds staging is up-to-date with main
3. No conflicts detected between feature and staging
4. PR is auto-approved with "Ready to Merge" status

### Scenario 2: Staging Behind Main

1. Developer creates PR from `feature/update` to `staging`
2. Workflow detects staging is 3 commits behind main
3. Automatically merges main into staging and pushes
4. Checks feature branch - no conflicts
5. PR is auto-approved

### Scenario 3: Merge Conflicts

1. Developer creates PR from `feature/big-change` to `staging`
2. Staging updates successfully from main
3. Feature branch has conflicts with updated staging
4. Workflow posts comment with:
   - List of conflicting files
   - Commands to resolve conflicts locally
   - PR marked as "failed" status

## Conflict Resolution Instructions

When conflicts are detected, the workflow provides specific instructions:

### For Staging-Main Conflicts:

```bash
# Checkout staging branch
git checkout staging
git pull origin staging
git pull origin main
# Resolve conflicts in your editor
git add .
git commit -m "Resolve merge conflicts with main"
git push origin staging
```

### For Feature-Staging Conflicts:

```bash
# Update your feature branch
git checkout feature/your-branch
git pull origin staging
# Resolve conflicts in your editor
git add .
git commit -m "Resolve merge conflicts with staging"
git push
```

## Best Practices

1. **Keep staging updated**: The workflow handles this automatically, but manual syncs can prevent large conflict sets

2. **Small, frequent PRs**: Reduce the likelihood of conflicts by merging changes frequently

3. **Monitor workflow runs**: Check the Actions tab for any failed sync attempts

4. **Resolve conflicts promptly**: Don't let conflicts accumulate; resolve them as soon as they're detected

5. **Use the manual trigger**: You can re-run the workflow after resolving conflicts by:
   - Pushing new commits to your PR
   - Using the "Re-run jobs" button in GitHub Actions

## Troubleshooting

### Common Issues:

**1. Push to staging fails**

- **Cause**: Branch protection rules or permissions
- **Solution**: Check repository settings and ensure the workflow has proper permissions

**2. Workflow skips processing**

- **Cause**: PR is not targeting staging or main branches
- **Solution**: Ensure your PR targets the correct base branch

**3. Auto-approval doesn't work**

- **Cause**: GitHub doesn't allow self-approval (PR author is the bot)
- **Solution**: This is expected behavior; manual approval still required

**4. Conflicts keep reappearing**

- **Cause**: New commits to main while resolving conflicts
- **Solution**: Pull latest changes from both main and staging before resolving

## Configuration

The workflow uses GitHub's built-in authentication:

- `GITHUB_TOKEN`: Automatically provided by GitHub Actions (no setup needed)

Required permissions (defined in the workflow):

- `contents: write` - For pushing commits to branches
- `pull-requests: write` - For commenting and approving PRs
- `statuses: write` - For updating commit statuses
- `issues: write` - For creating and updating PR comments

## Key Features

1. **Automatic Branch Synchronization**: When a PR is opened to staging, the workflow checks if staging is behind main and automatically merges main into staging
2. **Conflict Detection**: Performs dry-run merges to detect conflicts without actually merging
3. **Detailed Status Updates**: Posts comprehensive comments on PRs with current status and resolution steps
4. **Smart Auto-Approval**: Automatically approves PRs when no conflicts exist and branches are in sync
5. **Complete Audit Trail**: Every sync action is logged in PR comments and Git history

## How It Works

The workflow operates purely at the Git level:

**For Feature → Staging PRs**:

- Checks if staging is behind main
- If yes, automatically merges main into staging and pushes
- Then checks if the feature branch has conflicts with the updated staging
- Reports status and auto-approves if clean

**For Staging → Main PRs**:

- Verifies staging is up-to-date with main
- Checks for any merge conflicts
- Reports status and auto-approves if clean

## Summary

The PR Branch Sync Check workflow is a Git-based automation that ensures proper branch synchronization in your repository. By automatically keeping staging in sync with main and detecting conflicts early, it maintains a clean and predictable development flow. The workflow reduces manual overhead and helps teams avoid integration issues.

For questions or issues with this workflow, check the GitHub Actions logs or create an issue in the repository.

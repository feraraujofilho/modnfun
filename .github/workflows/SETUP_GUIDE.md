# Example Configuration for Theme Sync Workflow
# This file shows how to configure your repository for the theme sync workflow

# 1. Required Repository Secrets
# Go to Settings > Secrets and variables > Actions
# Add these secrets:
#
# PRODUCTION_STORE: your-store.myshopify.com
# PRODUCTION_THEME_ACCESS_PASSWORD: shptka_xxxxxxxxxxxxx
#
# To get the theme access password:
# 1. Go to your Shopify admin
# 2. Navigate to Online Store > Themes
# 3. Click "Manage theme access"
# 4. Create a new theme access password

# 2. Branch Protection Rules (optional but recommended)
# Go to Settings > Branches
# Add rule for 'staging':
# - Require pull request reviews before merging
# - Require status checks to pass (theme-sync-check)
# - Allow force pushes by GitHub Actions

# 3. Workflow Permissions
# The workflow file already includes required permissions:
# - contents: write (to push to branches)
# - pull-requests: write (to comment and approve)
# - statuses: write (to update commit status)
# - issues: write (to create comments)

# 4. Example .shopifyignore file (optional)
# Create this file in your repository root to exclude files from theme sync:
#
# config/settings_data.json
# templates/product.test.json
# assets/*.map

# 5. Testing the Workflow
# Create a test PR from any feature branch to staging:
#
# git checkout -b test/theme-sync
# echo "test" > test.txt
# git add test.txt
# git commit -m "Test theme sync workflow"
# git push origin test/theme-sync
#
# Then open a PR to staging and watch the workflow run

# 6. Monitoring
# - Check Actions tab for workflow runs
# - Review PR comments for sync status
# - Look for sync PRs if conflicts occur

# 7. Troubleshooting Commands
# If you need to manually sync:
#
# shopify theme pull --live --force
# git add -A
# git commit -m "Manual sync: Production theme"
# git push origin staging

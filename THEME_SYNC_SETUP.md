# Daily Theme Sync Guide: Production to Staging Using GitHub Actions

This guide demonstrates how to automatically synchronize your Shopify theme from production to staging daily using GitHub Actions, Shopify's GitHub integration, and the Theme Access app. This ensures your staging environment always reflects the latest production theme changes even when staff members perform updates via the theme editor in admin. Shopify merchants and partners have varying needs regarding staging and production workflows. This guide offers an example of how to synchronize daily production and staging theme changes, and the automation can be adapted to suit specific requirements.

**Example Implementation:** https://github.com/feraraujofilho/modnfun

## Prerequisites

- GitHub repository with main and staging branches connected to your production and staging stores respectively via Shopify GitHub integration
- Basic understanding of GitHub and version control

## Setup Steps

### Step 1: Install Theme Access App

The Theme Access app provides secure, scoped credentials for CI/CD operations without exposing admin credentials.

1. **Navigate to your production store admin:**

   ```
   https://your-production-store.myshopify.com/admin
   ```

2. **Install Theme Access:**

   - Install the ["Theme Access" app](https://apps.shopify.com/theme-access) (free)

3. **Generate access password:**
   - Open Theme Access from your Apps section
   - Click **Generate password**
   - Add your email and name
   - Click **Create password**
   - You will receive a link per email to access the password
   - Copy the password and the production store URL, you will need that

### Step 2: Configure GitHub Secrets

In your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secrets:

| Secret Name                        | Value                                 | Description                             |
| ---------------------------------- | ------------------------------------- | --------------------------------------- |
| `PRODUCTION_STORE`                 | `your-production-store.myshopify.com` | Your production store URL               |
| `PRODUCTION_THEME_ACCESS_PASSWORD` | `shptka_xxxxxxxxxxxx`                 | The Theme Access password you generated |

### Step 3: Create the Workflow File

Create `.github/workflows/sync-theme-prod-to-staging.yml`:

```yaml
name: Sync Theme from Production to Staging

on:
  schedule:
    # Runs daily at 2 AM UTC (adjust for your timezone)
    - cron: "0 2 * * *"
  workflow_dispatch: # Allows manual triggering

permissions:
  contents: write # For pushing commits
  issues: write # For creating issues on failure

jobs:
  sync-theme:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout staging branch
        uses: actions/checkout@v4
        with:
          ref: staging
          token: ${{ secrets.GITHUB_TOKEN }}

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "18"

      - name: Install Shopify CLI
        run: npm install -g @shopify/cli @shopify/theme

      - name: Pull theme from production
        env:
          SHOPIFY_FLAG_STORE: ${{ secrets.PRODUCTION_STORE }}
          SHOPIFY_CLI_THEME_TOKEN: ${{ secrets.PRODUCTION_THEME_ACCESS_PASSWORD }}
          SHOPIFY_CLI_TTY: 0
        run: |
          # Pull the currently published theme
          shopify theme pull --live --force

      - name: Check for changes
        id: check_changes
        run: |
          if [[ -z $(git status --porcelain) ]]; then
            echo "No changes detected"
            echo "has_changes=false" >> $GITHUB_OUTPUT
          else
            echo "Changes detected"
            echo "has_changes=true" >> $GITHUB_OUTPUT
          fi

      - name: Commit and push changes
        if: steps.check_changes.outputs.has_changes == 'true'
        run: |
          git config user.name "GitHub Actions Bot"
          git config user.email "actions@github.com"

          # Add all changes
          git add -A

          # Create commit with timestamp
          TIMESTAMP=$(date -u +"%Y-%m-%d %H:%M:%S UTC")
          git commit -m "Sync theme from production - $TIMESTAMP"

          # Push to staging branch
          git push origin staging
        continue-on-error: true
        id: push_changes

      - name: Check push result
        if: steps.check_changes.outputs.has_changes == 'true' && steps.push_changes.outcome == 'failure'
        run: |
          echo "::error::Failed to push changes to staging branch. This might be due to conflicts."
          exit 1

      - name: Send failure notification
        if: failure()
        uses: actions/github-script@v7
        with:
          script: |
            const issue = await github.rest.issues.create({
              owner: context.repo.owner,
              repo: context.repo.repo,
              title: `Theme Sync Failed - ${new Date().toISOString().split('T')[0]}`,
              body: `The daily theme sync from production to staging failed.\n\nWorkflow run: ${context.serverUrl}/${context.repo.owner}/${context.repo.repo}/actions/runs/${context.runId}\n\nThis is likely due to conflicts between production and staging themes. Please resolve manually.`,
              labels: ['automation-failure', 'theme-sync']
            });
```

### Step 4: Customize the Schedule (Optional)

The workflow is set to run daily at 2 AM UTC. To change this:

1. Edit `.github/workflows/sync-theme-prod-to-staging.yml`
2. Modify the cron expression in the `schedule` section
3. Use [crontab.guru](https://crontab.guru/) to help create your desired schedule

Common examples:

- `0 6 * * *` - Daily at 6 AM UTC
- `0 */6 * * *` - Every 6 hours
- `0 9 * * 1-5` - Weekdays at 9 AM UTC

### Step 5: Test the Workflow

1. Go to **Actions** tab in your GitHub repository
2. Find "Sync Theme from Production to Staging"
3. Click **Run workflow** → **Run workflow** to test manually
4. Monitor the workflow execution

## How It Works

1. **Daily Trigger**: The workflow runs automatically at the scheduled time
2. **Checkout**: Checks out your staging branch
3. **Setup**: Installs Node.js and Shopify CLI
4. **Pull Theme**: Downloads the live theme from production using the Theme Access password
5. **Check Changes**: Detects if there are any changes
6. **Commit & Push**: If changes exist, commits them to staging branch
7. **Shopify Integration**: Your existing GitHub-Shopify integration automatically deploys to staging
8. **Error Handling**: If conflicts occur, the workflow fails and creates an issue

## Monitoring and Troubleshooting

### Successful Syncs

- Check the **Actions** tab for green checkmarks
- Review commits in the staging branch with timestamps

### Failed Syncs

- GitHub will create an issue labeled `automation-failure` and `theme-sync`
- Check the workflow logs in the Actions tab
- Common issues:
  - **Conflicts**: Manual changes in staging that conflict with production
  - **Authentication**: Expired or incorrect Theme Access password
  - **Rate Limits**: Too many API calls (rare with daily syncs)

### Manual Sync

You can trigger a sync manually anytime:

1. Go to Actions → "Sync Theme from Production to Staging"
2. Click "Run workflow"

## Security Notes

- Theme Access passwords are stored as encrypted GitHub secrets
- These passwords only have access to theme files, not customer or order data
- Passwords don't expire automatically but can be revoked anytime
- Best practice: Rotate passwords every 90 days

## Maintenance

### Rotating Theme Access Passwords

1. Generate a new password in the Theme Access app
2. Update the GitHub secret `PRODUCTION_THEME_ACCESS_PASSWORD`
3. Delete the old password from the Theme Access app

### Updating the Workflow

- The workflow file can be edited directly in the repository
- Changes take effect immediately for manual runs
- Scheduled runs use the workflow version from the default branch

## Additional Considerations

### Excluding Files

If you need to exclude certain files from sync:

1. Create a `.shopifyignore` file in your repository
2. Add patterns for files to ignore (similar to `.gitignore`)

### Notification Options

The current setup creates GitHub issues on failure. You can also:

- Add Slack notifications
- Send emails via GitHub Actions
- Integrate with your monitoring system

## Troubleshooting Theme Access

If you're having issues with Theme Access:

- Make sure you check your email for the password link
- The password link is sent to the email you provided when generating the password
- Store the password securely as it won't be shown again
- The store URL should be in the format: `store-name.myshopify.com` (no https://)

For more information, see [Shopify's documentation on CI/CD with themes](https://shopify.dev/docs/storefronts/themes/tools/cli/ci-cd).

# Theme Sync Automation Setup Guide

This guide will help you set up automated daily synchronization of your Shopify theme from production to staging.

## Prerequisites

- GitHub repository with staging branch connected to your staging store via Shopify GitHub integration
- Admin access to both production and staging Shopify stores
- Admin access to the GitHub repository

## Setup Steps

### 1. Generate Theme Access Passwords

Theme Access passwords are specifically designed for CI/CD operations with Shopify themes. You'll need to generate one for your production store.

#### For Production Store:

1. **Install the Theme Access app**:

   - Go to your production store admin: `https://your-production-store.myshopify.com/admin`
   - Navigate to **Apps** → **Visit the Shopify App Store**
   - Search for "Theme Access" by Shopify
   - Install the Theme Access app (it's free)

2. **Generate a password**:

   - Once installed, open the Theme Access app from your Apps section
   - Click **Generate password**
   - Give it a descriptive name like "GitHub Actions Theme Sync"
   - Copy the password immediately - it will only be shown once!
   - The password will look like: `shptka_xxxxxxxxxxxx`

3. **Important notes**:
   - Theme Access passwords are scoped specifically for theme operations
   - They provide read/write access to themes without exposing your full admin credentials
   - Each password is tied to the specific store where it was generated

### 2. Configure GitHub Secrets

In your GitHub repository:

1. Go to **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Add the following secrets:

| Secret Name                        | Value                                 | Description                             |
| ---------------------------------- | ------------------------------------- | --------------------------------------- |
| `PRODUCTION_STORE`                 | `your-production-store.myshopify.com` | Your production store URL               |
| `PRODUCTION_THEME_ACCESS_PASSWORD` | `shptka_xxxxxxxxxxxx`                 | The Theme Access password you generated |

### 3. Create the Workflow File

The workflow file has already been created at `.github/workflows/sync-theme-prod-to-staging.yml`

### 4. Customize the Schedule (Optional)

The workflow is set to run daily at 2 AM UTC. To change this:

1. Edit `.github/workflows/sync-theme-prod-to-staging.yml`
2. Modify the cron expression in the `schedule` section
3. Use [crontab.guru](https://crontab.guru/) to help create your desired schedule

Common examples:

- `0 6 * * *` - Daily at 6 AM UTC
- `0 */6 * * *` - Every 6 hours
- `0 9 * * 1-5` - Weekdays at 9 AM UTC

### 5. Test the Workflow

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

If you can't find the Theme Access app:

- Make sure you're looking in the Shopify App Store, not the admin apps section
- The app is created by Shopify and should be free
- Alternative: You can use the Shopify Partners CLI token if you have a Partner account

For more information, see [Shopify's documentation on CI/CD with themes](https://shopify.dev/docs/storefronts/themes/tools/cli/ci-cd).

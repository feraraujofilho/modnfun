# Modnfun Shopify Theme

A modern Shopify theme for Modnfun store with automated production-to-staging synchronization.

## Overview

This repository contains the Shopify theme for Modnfun, featuring:

- 🎨 Customizable Sense-based theme
- 🔄 Automated daily sync from production to staging
- 🌍 Multi-language support (20+ languages)
- 📱 Responsive design
- 🛍️ Optimized for e-commerce conversions

## Repository Structure

```
modnfun/
├── .github/workflows/     # GitHub Actions automation
├── assets/               # Theme assets (CSS, JS, images)
├── config/               # Theme configuration files
├── layout/               # Theme layouts
├── locales/              # Translation files
├── sections/             # Theme sections
├── snippets/             # Reusable code snippets
└── templates/            # Page templates
```

## Features

### Theme Components

- **Hero Sections**: Image banners, slideshows, and featured content
- **Product Display**: Collection grids, featured products, quick add functionality
- **Content Sections**: Rich text, multi-column layouts, collapsible content
- **Navigation**: Mega menu support, mobile-optimized drawer menu
- **Cart**: Ajax cart drawer, cart notifications
- **Localization**: Multi-language and multi-currency support

### Automation

- **Daily Theme Sync**: Automatically syncs production theme changes to staging
- **GitHub Integration**: Direct deployment to Shopify stores via GitHub branches

## Setup

### Prerequisites

- Shopify store with GitHub integration enabled
- Node.js 18+ (for local development)
- Shopify CLI (optional, for local development)

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/feraraujofilho/modnfun.git
   cd modnfun
   ```

2. **Install Shopify CLI** (for local development)

   ```bash
   npm install -g @shopify/cli @shopify/theme
   ```

3. **Connect to your store**
   ```bash
   shopify theme dev --store your-store.myshopify.com
   ```

## Development Workflow

### Branches

- `main`: Connected to production store
- `staging`: Connected to staging store
- Feature branches: For development work

### Making Changes

1. **Create a feature branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Make your changes**

   - Edit theme files as needed
   - Test locally using Shopify CLI

3. **Commit and push**

   ```bash
   git add .
   git commit -m "Description of changes"
   git push origin feature/your-feature-name
   ```

4. **Create a pull request**
   - Target the `staging` branch for testing
   - After testing, merge to `main` for production

## Automated Sync

This repository includes automated daily synchronization from production to staging. This ensures staging always reflects the latest production theme, including changes made through the Shopify admin theme editor.

**Learn more**: See [THEME_SYNC_SETUP.md](./THEME_SYNC_SETUP.md) for detailed setup instructions.

### How it works

- Runs daily at 2 AM UTC (configurable)
- Pulls live theme from production
- Commits changes to staging branch
- Automatically deploys via GitHub-Shopify integration

### Manual sync

Trigger a sync anytime from the Actions tab in GitHub.

## Theme Customization

### Settings Schema

Theme settings are defined in `config/settings_schema.json`. Access these in the Shopify admin under **Online Store > Themes > Customize**.

### Adding New Sections

1. Create a new file in `sections/`
2. Define section schema and settings
3. Add section to relevant templates

### Translations

Add or modify translations in the `locales/` directory. The theme supports:

- English (default)
- German, Spanish, French, Italian, Japanese, Korean, and more

## Deployment

### Production Deployment

1. Merge changes to `main` branch
2. GitHub automatically deploys to production store

### Staging Deployment

1. Merge changes to `staging` branch
2. GitHub automatically deploys to staging store

## Contributing

1. Follow the development workflow above
2. Test all changes in staging before production
3. Keep commits focused and descriptive
4. Update documentation as needed

## Support

For issues or questions:

1. Check existing [GitHub Issues](https://github.com/feraraujofilho/modnfun/issues)
2. Create a new issue with detailed information
3. Contact the development team

## License

This is a private repository. All rights reserved.

---

**Repository**: https://github.com/feraraujofilho/modnfun  
**Documentation**: [Theme Sync Setup](./THEME_SYNC_SETUP.md)

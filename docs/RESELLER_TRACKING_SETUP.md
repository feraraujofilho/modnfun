# Reseller Tracking System Setup Guide

This guide will help you set up a reseller tracking system that allows resellers to share signup links with their clients, automatically associating new customers with the referring reseller.

## Overview

The reseller tracking system consists of:

1. A dedicated landing page template (`page.reseller-signup`)
2. A tracking script (`reseller-tracker.js`)
3. Customer notes and tags to store reseller associations
4. Automated form handling for both signup and login

## Setup Instructions

### Step 1: Create a New Page in Shopify Admin

1. Go to **Online Store > Pages** in your Shopify admin
2. Click **Add page**
3. Enter a title (e.g., "Partner Signup" or "Reseller Registration")
4. In the **Theme template** dropdown, select `page.reseller-signup`
5. Save the page

### Step 2: Set Up Customer Metafields

Since the storefront can't directly create metafields, you'll need to use one of these approaches:

#### Option A: Using Shopify Flow (Recommended)

1. Install the **Shopify Flow** app from the Shopify App Store
2. Create a new workflow:
   - **Trigger**: Customer created
   - **Condition**: Check if customer note contains "Reseller Code:"
   - **Action**: Update customer metafield
3. Set up the metafield definition:
   - Go to **Settings > Custom data > Customers**
   - Add a new metafield:
     - Name: `Reseller Code`
     - Namespace and key: `custom.reseller_code`
     - Type: `Single line text`

#### Option B: Using a Custom App

If you need more advanced functionality, create a custom app that:

1. Listens to the `customers/create` webhook
2. Reads the reseller code from the customer note or tags
3. Updates the customer metafield via Admin API

### Step 3: Configure the Landing Page

The reseller signup section has several customization options:

1. Go to **Online Store > Themes > Customize**
2. Navigate to your reseller signup page
3. Configure the section settings:
   - **Page Title**: Main heading for the page
   - **Banner Title**: Title shown when a reseller code is detected
   - **Banner Text**: Message explaining the reseller association
   - **Login Notice**: Message shown to existing customers

## How Resellers Use the System

### Generating Signup Links

Resellers create links by adding their unique code as a URL parameter:

```
https://yourstore.com/pages/partner-signup?code=RESELLER123
```

Alternative parameter names also work:

```
https://yourstore.com/pages/partner-signup?reseller=RESELLER123
```

### What Happens When Customers Visit

1. **New Customers**:

   - See a banner showing which reseller referred them
   - Fill out the signup form
   - The reseller code is automatically added to their customer note
   - Customer is tagged with `reseller-{code}`

2. **Existing Customers**:
   - See the login form with a notice
   - Can log in normally
   - The reseller association is preserved for tracking

### Tracking Features

The system automatically:

- Stores the reseller code in browser storage for persistence
- Adds the code to customer notes (e.g., "Reseller Code: ABC123")
- Tags customers (e.g., "reseller-ABC123")
- Sets a cookie for server-side tracking if needed

## Managing Reseller Data

### Finding Customers by Reseller

In Shopify Admin, you can:

1. Search customers by tag: `tag:reseller-ABC123`
2. Filter customers whose notes contain specific reseller codes
3. Export customer data and filter by reseller information

### Reporting

To create reseller reports:

1. Use Shopify's customer export feature
2. Filter the CSV by reseller tags or notes
3. Use Shopify Flow to automate reporting
4. Consider using Shopify's Analytics APIs for advanced reporting

## Advanced Configuration

### Customizing the Reseller Code Format

Edit `reseller-tracker.js` to add validation:

```javascript
// Add code validation
if (code && !code.match(/^[A-Z0-9]{6,}$/)) {
  console.error("Invalid reseller code format");
  return;
}
```

### Adding Email Notifications

Use Shopify Flow to:

1. Send welcome emails mentioning the reseller
2. Notify resellers when their referrals sign up
3. Create reseller-specific email campaigns

### Multiple Reseller Support

To prevent customers from switching resellers:

- The current implementation stores the first reseller code encountered
- Once set, the association cannot be changed through the signup form
- Manual updates require admin intervention

## Troubleshooting

### Common Issues

1. **Reseller code not showing**:

   - Check that the URL parameter is correctly formatted
   - Verify JavaScript is enabled in the browser
   - Check browser console for errors

2. **Customer not tagged**:

   - Ensure the form is submitting successfully
   - Check that customer tags are enabled in your store
   - Verify the reseller code doesn't contain special characters

3. **Existing customer message not showing**:
   - This relies on Shopify's form error messages
   - Check that the email is already registered
   - Ensure form validation is working correctly

### Testing

1. Test with a sample reseller code: `?code=TEST123`
2. Try both signup and login flows
3. Verify data persistence across page refreshes
4. Check customer data in Shopify admin after signup

## Security Considerations

- Reseller codes should be unique and hard to guess
- Consider adding rate limiting for signup attempts
- Monitor for unusual signup patterns
- Regularly audit reseller performance

## Support

For additional help:

1. Check the browser console for JavaScript errors
2. Review Shopify's customer API documentation
3. Test with different browsers and devices
4. Contact your developer for custom modifications

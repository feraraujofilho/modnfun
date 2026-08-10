# Shopify Flow Automation for Reseller Tracking

This document provides a template for creating a Shopify Flow automation that automatically extracts reseller codes from customer data and stores them in metafields.

## Workflow Configuration

### Trigger

- **Type**: Customer created
- **Description**: Triggers when a new customer account is created

### Conditions

Set up an OR condition to check for reseller codes in either customer notes or tags:

1. **Customer Note Check**

   - Field: `customer.note`
   - Operator: `contains`
   - Value: `Reseller Code:`

2. **Customer Tag Check**
   - Field: `customer.tags`
   - Operator: `contains`
   - Value: `reseller-`

### Actions

#### Action 1: Update Customer Metafield

- **Type**: Update customer metafield
- **Metafield Configuration**:
  - Namespace: `custom`
  - Key: `reseller_code`
  - Type: `single_line_text_field`
  - Value: Use the Liquid code below

#### Action 2: Add Tracking Tag

- **Type**: Add customer tag
- **Tag**: `reseller-tracked`

## Liquid Code for Extracting Reseller Code

Use this Liquid code in the metafield value field:

```liquid
{% if customer.note contains 'Reseller Code:' %}
  {% assign parts = customer.note | split: 'Reseller Code: ' %}
  {% assign code = parts[1] | split: ' ' | first %}
  {{ code }}
{% elsif customer.tags contains 'reseller-' %}
  {% for tag in customer.tags %}
    {% if tag contains 'reseller-' %}
      {% assign code = tag | remove: 'reseller-' %}
      {{ code }}
      {% break %}
    {% endif %}
  {% endfor %}
{% endif %}
```

## Setup Instructions

1. **Install Shopify Flow** from the Shopify App Store (if not already installed)

2. **Create Customer Metafield Definition**:

   - Go to Settings > Custom data > Customers
   - Click "Add definition"
   - Set namespace to `custom` and key to `reseller_code`
   - Select type as "Single line text"
   - Save the definition

3. **Create the Flow**:

   - Open Shopify Flow app
   - Click "Create workflow"
   - Add the trigger, conditions, and actions as described above
   - Paste the Liquid code in the metafield value field
   - Name your workflow (e.g., "Reseller Code Tracking")
   - Activate the workflow

4. **Test the Workflow**:
   - Create a test customer with a note containing "Reseller Code: TEST123"
   - Verify the metafield is populated correctly
   - Check that the "reseller-tracked" tag is added

## Alternative Configurations

### Email Notification to Reseller

Add an additional action to notify resellers when someone signs up:

- **Action Type**: Send email
- **Condition**: Only if reseller email mapping exists
- **Email Template**: Custom notification template

### Different Storage Locations

Instead of metafields, you could:

- Add multiple tags for categorization
- Update customer notes with formatted data
- Trigger webhook to external tracking system

## Troubleshooting

- **Metafield not updating**: Ensure the metafield definition exists before creating the flow
- **Code not extracted correctly**: Check that the format in customer notes matches exactly
- **Flow not triggering**: Verify the flow is activated and conditions are met

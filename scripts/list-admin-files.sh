#!/bin/bash

# List Shopify Admin Files
# This script lists all files from Content > Files in Shopify Admin

# Configuration
STORE="${SHOPIFY_STORE:-your-store.myshopify.com}"
ACCESS_TOKEN="${SHOPIFY_ACCESS_TOKEN:-your-access-token}"
API_VERSION="2025-01"

# GraphQL query
QUERY='
{
  "query": "query { files(first: 250) { edges { node { alt createdAt ... on MediaImage { id image { url width height } } ... on GenericFile { id url } ... on Video { id originalSource { url } } } } } }"
}'

# Make the request
echo "Fetching files from Shopify Admin..."
echo ""

response=$(curl -s -X POST \
  "https://$STORE/admin/api/$API_VERSION/graphql.json" \
  -H "X-Shopify-Access-Token: $ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d "$QUERY")

# Parse and display results
echo "$response" | jq -r '
  .data.files.edges[] | 
  .node | 
  "\(.createdAt | split("T")[0]) - \(.image.url // .url // .originalSource.url)"
' | sort 
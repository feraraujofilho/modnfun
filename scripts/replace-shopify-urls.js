#!/usr/bin/env node

/**
 * Replace Shopify Protocol URLs with Direct CDN URLs
 * This script finds all shopify:// references in theme files and replaces them with actual URLs
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

// Configuration
const config = {
  staging: {
    store: process.env.STAGING_STORE || "your-staging-store.myshopify.com",
    accessToken:
      process.env.STAGING_ACCESS_TOKEN || "your-staging-access-token",
  },
  apiVersion: "2025-01",
};

// Directories to scan for theme files
const THEME_DIRECTORIES = [
  "templates",
  "sections",
  "snippets",
  "layout",
  "config",
];

// File extensions to process
const FILE_EXTENSIONS = [".json", ".liquid"];

/**
 * GraphQL query to get file by filename
 */
const getFileByNameQuery = `
  query getFileByName($query: String!) {
    files(first: 1, query: $query) {
      edges {
        node {
          ... on MediaImage {
            image {
              url
            }
          }
          ... on GenericFile {
            url
          }
          ... on Video {
            originalSource {
              url
            }
          }
        }
      }
    }
  }
`;

/**
 * Make GraphQL request
 */
function makeGraphQLRequest(store, accessToken, query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });

    const options = {
      hostname: store.replace("https://", "").replace("http://", ""),
      path: `/admin/api/${config.apiVersion}/graphql.json`,
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": accessToken,
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(data),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => (responseData += chunk));
      res.on("end", () => {
        try {
          const parsed = JSON.parse(responseData);
          if (parsed.errors) {
            reject(new Error(JSON.stringify(parsed.errors)));
          } else {
            resolve(parsed.data);
          }
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on("error", reject);
    req.write(data);
    req.end();
  });
}

/**
 * Get CDN URL for a filename
 */
async function getCDNUrl(filename) {
  try {
    const data = await makeGraphQLRequest(
      config.staging.store,
      config.staging.accessToken,
      getFileByNameQuery,
      { query: filename }
    );

    const files = data.files.edges;
    if (files.length === 0) {
      return null;
    }

    const node = files[0].node;
    if (node.image) {
      return node.image.url;
    } else if (node.url) {
      return node.url;
    } else if (node.originalSource) {
      return node.originalSource.url;
    }

    return null;
  } catch (error) {
    console.error(`Error getting URL for ${filename}:`, error.message);
    return null;
  }
}

/**
 * Extract filename from shopify:// URL
 */
function extractFilename(shopifyUrl) {
  const match = shopifyUrl.match(/shopify:\/\/[^\/]+\/(.+)/);
  return match ? match[1] : null;
}

/**
 * Process a single file
 */
async function processFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, "utf8");
    const originalContent = content;

    // Find all shopify:// URLs
    const shopifyUrlRegex =
      /shopify:\/\/(?:shop_images|files|videos)\/[^"'\s]+/g;
    const matches = content.match(shopifyUrlRegex) || [];

    if (matches.length === 0) {
      return { processed: false };
    }

    console.log(`\n📄 Processing: ${filePath}`);
    console.log(`   Found ${matches.length} shopify:// reference(s)`);

    // Get unique URLs
    const uniqueUrls = [...new Set(matches)];
    let replacedCount = 0;

    // Process each unique URL
    for (const shopifyUrl of uniqueUrls) {
      const filename = extractFilename(shopifyUrl);
      if (!filename) continue;

      console.log(`   🔍 Looking up: ${filename}`);
      const cdnUrl = await getCDNUrl(filename);

      if (cdnUrl) {
        // Replace all occurrences of this shopify URL with the CDN URL
        content = content.replace(
          new RegExp(shopifyUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
          cdnUrl
        );
        console.log(`   ✅ Replaced with: ${cdnUrl}`);
        replacedCount++;
      } else {
        console.log(`   ❌ Not found in staging`);
      }
    }

    // Write back if changes were made
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, "utf8");
      return { processed: true, replacedCount };
    }

    return { processed: false };
  } catch (error) {
    console.error(`Error processing ${filePath}:`, error.message);
    return { processed: false, error: error.message };
  }
}

/**
 * Recursively find all theme files
 */
function findThemeFiles(dir, files = []) {
  const items = fs.readdirSync(dir);

  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);

    if (stat.isDirectory()) {
      findThemeFiles(fullPath, files);
    } else if (FILE_EXTENSIONS.some((ext) => item.endsWith(ext))) {
      files.push(fullPath);
    }
  }

  return files;
}

/**
 * Main function
 */
async function replaceShopifyUrls() {
  try {
    console.log("🔄 Replace Shopify URLs with CDN URLs\n");
    console.log(`📍 Staging Store: ${config.staging.store}\n`);

    // Check configuration
    if (config.staging.accessToken === "your-staging-access-token") {
      console.error("❌ Error: Please set environment variables:");
      console.error(
        '  export STAGING_STORE="your-staging-store.myshopify.com"'
      );
      console.error('  export STAGING_ACCESS_TOKEN="shpat_xxxxx"\n');
      process.exit(1);
    }

    // Find all theme files
    console.log("🔍 Scanning theme directories...");
    const themeFiles = [];

    for (const dir of THEME_DIRECTORIES) {
      const dirPath = path.join(process.cwd(), "..", dir);
      if (fs.existsSync(dirPath)) {
        const files = findThemeFiles(dirPath);
        themeFiles.push(...files);
        console.log(`   ✓ ${dir}: ${files.length} files`);
      }
    }

    console.log(`\n📊 Total files to scan: ${themeFiles.length}`);

    // Process each file
    let processedCount = 0;
    let totalReplacements = 0;

    for (const filePath of themeFiles) {
      const result = await processFile(filePath);
      if (result.processed) {
        processedCount++;
        totalReplacements += result.replacedCount || 0;
      }
    }

    // Summary
    console.log(`\n${"=".repeat(60)}`);
    console.log(`✅ Processing complete!`);
    console.log(`   Files modified: ${processedCount}`);
    console.log(`   URLs replaced: ${totalReplacements}`);

    if (processedCount > 0) {
      console.log(`\n⚠️  Important: Theme files have been modified locally.`);
      console.log(`   You need to push these changes to Shopify:`);
      console.log(`   1. Review the changes`);
      console.log(`   2. Use Shopify CLI to push: shopify theme push`);
    }
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
}

// Run the script
replaceShopifyUrls();

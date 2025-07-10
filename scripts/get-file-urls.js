#!/usr/bin/env node

/**
 * Get Direct URLs for Files in Staging
 * This script retrieves the direct CDN URLs for files that can be used in themes
 */

const https = require("https");

// Configuration
const config = {
  staging: {
    store: process.env.STAGING_STORE || "your-staging-store.myshopify.com",
    accessToken:
      process.env.STAGING_ACCESS_TOKEN || "your-staging-access-token",
  },
  apiVersion: "2025-01",
};

/**
 * GraphQL query to get specific files with their URLs
 */
const getFileUrlsQuery = `
  query getFileUrls($query: String!) {
    files(first: 10, query: $query) {
      edges {
        node {
          alt
          ... on MediaImage {
            id
            image {
              url
              width
              height
            }
          }
          ... on GenericFile {
            id
            url
          }
          ... on Video {
            id
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
 * Get URL for a specific file
 */
async function getFileUrl(filename) {
  try {
    const data = await makeGraphQLRequest(
      config.staging.store,
      config.staging.accessToken,
      getFileUrlsQuery,
      { query: filename }
    );

    const files = data.files.edges;

    if (files.length === 0) {
      return null;
    }

    const node = files[0].node;
    let url = null;

    if (node.image) {
      url = node.image.url;
    } else if (node.url) {
      url = node.url;
    } else if (node.originalSource) {
      url = node.originalSource.url;
    }

    return {
      filename,
      url,
      id: node.id,
      alt: node.alt,
    };
  } catch (error) {
    console.error(`Error getting URL for ${filename}:`, error.message);
    return null;
  }
}

/**
 * Main function
 */
async function getFileUrls() {
  try {
    console.log("🔍 Getting Direct URLs for Files in Staging\n");
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

    // Files to check - add more as needed
    const filesToCheck = [
      "Ocean.avif",
      "knightsbridge-rolex-boutique-square.webp",
      "woman-2564660_1280.jpg",
      "8296085-hd_1920_1080_25fps.mp4",
    ];

    console.log("File URLs for Theme Usage:\n");
    console.log("=" * 60 + "\n");

    for (const filename of filesToCheck) {
      const fileInfo = await getFileUrl(filename);

      if (fileInfo) {
        console.log(`📄 ${fileInfo.filename}`);
        console.log(`   URL: ${fileInfo.url}`);
        console.log(`   ID: ${fileInfo.id}`);
        console.log(`   Alt: ${fileInfo.alt || "(no alt text)"}`);
        console.log("");
      } else {
        console.log(`❌ ${filename} - Not found`);
        console.log("");
      }
    }

    console.log("\n💡 How to use these URLs:");
    console.log("1. Copy the URL for the file you need");
    console.log(
      "2. In the theme editor, paste the URL directly in the image field"
    );
    console.log(
      "3. Or update your theme files to use the direct URL instead of shopify://"
    );
    console.log("\nExample: Replace");
    console.log('  "image": "shopify://shop_images/Ocean.avif"');
    console.log("With:");
    console.log('  "image": "https://cdn.shopify.com/s/files/..."');
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
}

// Run the script
getFileUrls();

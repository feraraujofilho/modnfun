#!/usr/bin/env node

/**
 * Debug File References
 * This script checks if specific files exist in staging and shows their URLs
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
 * GraphQL query to search for specific files
 */
const searchFilesQuery = `
  query searchFiles($query: String!) {
    files(first: 10, query: $query) {
      edges {
        node {
          alt
          createdAt
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
 * Search for files by filename
 */
async function searchForFile(filename) {
  try {
    console.log(`\n🔍 Searching for: ${filename}`);

    const data = await makeGraphQLRequest(
      config.staging.store,
      config.staging.accessToken,
      searchFilesQuery,
      { query: filename }
    );

    const files = data.files.edges;

    if (files.length === 0) {
      console.log(`❌ No files found matching "${filename}"`);
      return null;
    }

    console.log(`✅ Found ${files.length} file(s):`);

    files.forEach((edge, index) => {
      const node = edge.node;
      console.log(`\n  File ${index + 1}:`);
      console.log(`  - ID: ${node.id}`);
      console.log(`  - Alt: ${node.alt || "(no alt text)"}`);
      console.log(`  - Created: ${node.createdAt}`);

      if (node.image) {
        console.log(`  - Type: IMAGE`);
        console.log(`  - URL: ${node.image.url}`);
        console.log(`  - Dimensions: ${node.image.width}x${node.image.height}`);
      } else if (node.url) {
        console.log(`  - Type: FILE`);
        console.log(`  - URL: ${node.url}`);
      } else if (node.originalSource) {
        console.log(`  - Type: VIDEO`);
        console.log(`  - URL: ${node.originalSource.url}`);
      }
    });

    return files[0];
  } catch (error) {
    console.error(`❌ Error searching for file:`, error.message);
    return null;
  }
}

/**
 * Main debug function
 */
async function debugFileReferences() {
  try {
    console.log("🔍 Debug File References\n");
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

    // Search for specific files mentioned in the theme
    const filesToCheck = [
      "Ocean.avif",
      "Ocean",
      "ocean",
      // Add more filenames here if needed
    ];

    for (const filename of filesToCheck) {
      await searchForFile(filename);
    }

    console.log("\n" + "=".repeat(60));
    console.log("\n💡 Notes:");
    console.log(
      "- The shopify:// protocol should work if files exist with the same filename"
    );
    console.log("- Check that the file URLs contain the expected filename");
    console.log("- If files are missing, run the sync script again");
    console.log("- Make sure to clear cache and refresh the theme editor");
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
}

// Run the debug
debugFileReferences();

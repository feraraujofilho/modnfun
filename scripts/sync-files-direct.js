#!/usr/bin/env node

/**
 * Direct Sync Files from Production to Staging
 * This script copies files directly using URLs without downloading
 */

const https = require("https");

// Configuration
const config = {
  production: {
    store:
      process.env.PRODUCTION_STORE || "your-production-store.myshopify.com",
    accessToken:
      process.env.PRODUCTION_ADMIN_API_TOKEN || "your-production-access-token",
  },
  staging: {
    store: process.env.SHOPIFY_FLAG_STORE || "your-staging-store.myshopify.com",
    accessToken:
      process.env.STAGING_ADMIN_API_TOKEN || "your-staging-access-token",
  },
  apiVersion: "2025-01",
};

/**
 * GraphQL query to fetch files from production
 */
const filesQuery = `
  query getFiles($cursor: String) {
    files(first: 50, after: $cursor) {
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
        cursor
      }
      pageInfo {
        hasNextPage
      }
    }
  }
`;

/**
 * GraphQL mutation to create file in staging
 */
const fileCreateMutation = `
  mutation fileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        alt
        ... on MediaImage {
          image {
            url
          }
        }
        ... on GenericFile {
          url
        }
        ... on Video {
          sources {
            url
          }
        }
      }
      userErrors {
        field
        message
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
 * Extract filename from URL
 */
function getFilenameFromUrl(url) {
  try {
    const urlParts = url.split("/");
    const filename = urlParts[urlParts.length - 1].split("?")[0];
    return filename || "unnamed-file";
  } catch (e) {
    return "unnamed-file";
  }
}

/**
 * Fetch all files from production
 */
async function fetchProductionFiles(cursor = null) {
  const allFiles = [];

  try {
    console.log("📥 Fetching files from production store...");
    const data = await makeGraphQLRequest(
      config.production.store,
      config.production.accessToken,
      filesQuery,
      { cursor }
    );

    const files = data.files.edges;

    for (const edge of files) {
      const node = edge.node;
      let fileInfo = {
        alt: node.alt || "",
        createdAt: node.createdAt,
      };

      if (node.image) {
        fileInfo.url = node.image.url;
        fileInfo.type = "IMAGE";
        fileInfo.filename = getFilenameFromUrl(node.image.url);
      } else if (node.url) {
        fileInfo.url = node.url;
        fileInfo.type = "FILE";
        fileInfo.filename = getFilenameFromUrl(node.url);
      } else if (node.originalSource) {
        fileInfo.url = node.originalSource.url;
        fileInfo.type = "VIDEO";
        fileInfo.filename = getFilenameFromUrl(node.originalSource.url);
      }

      if (fileInfo.url) {
        allFiles.push(fileInfo);
      }
    }

    // Recursively fetch next page
    if (data.files.pageInfo.hasNextPage) {
      const lastCursor = files[files.length - 1].cursor;
      const nextFiles = await fetchProductionFiles(lastCursor);
      allFiles.push(...nextFiles);
    }

    return allFiles;
  } catch (error) {
    console.error("Error fetching files:", error.message);
    throw error;
  }
}

/**
 * Create file in staging using URL
 */
async function createFileInStaging(fileInfo) {
  try {
    // Determine the correct contentType based on file extension
    let contentType = fileInfo.type;

    // For images, always use IMAGE regardless of specific format
    if (fileInfo.type === "IMAGE") {
      contentType = "IMAGE";
    } else if (fileInfo.type === "VIDEO") {
      contentType = "VIDEO";
    } else {
      contentType = "FILE";
    }

    const fileCreateInput = {
      files: [
        {
          alt: fileInfo.alt || fileInfo.filename,
          contentType: contentType,
          originalSource: fileInfo.url,
          filename: fileInfo.filename, // This preserves the original filename with extension
        },
      ],
    };

    const data = await makeGraphQLRequest(
      config.staging.store,
      config.staging.accessToken,
      fileCreateMutation,
      fileCreateInput
    );

    if (data.fileCreate.userErrors.length > 0) {
      throw new Error(JSON.stringify(data.fileCreate.userErrors));
    }

    const createdFile = data.fileCreate.files[0];
    const newUrl =
      createdFile.image?.url ||
      createdFile.url ||
      (createdFile.sources && createdFile.sources[0]?.url) ||
      "URL not available";

    return {
      success: true,
      url: newUrl,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Main sync function
 */
async function syncFiles() {
  try {
    console.log("🔄 Direct File Sync: Production → Staging\n");
    console.log(`📍 Production: ${config.production.store}`);
    console.log(`📍 Staging: ${config.staging.store}\n`);

    // Check configuration
    if (
      config.production.accessToken === "your-production-access-token" ||
      config.staging.accessToken === "your-staging-access-token"
    ) {
      console.error("❌ Error: Please set environment variables:");
      console.error(
        '  export PRODUCTION_STORE="your-production-store.myshopify.com"'
      );
      console.error('  export PRODUCTION_ACCESS_TOKEN="shpat_xxxxx"');
      console.error(
        '  export STAGING_STORE="your-staging-store.myshopify.com"'
      );
      console.error('  export STAGING_ACCESS_TOKEN="shpat_xxxxx"\n');
      process.exit(1);
    }

    // Fetch all files from production
    const productionFiles = await fetchProductionFiles();
    console.log(`📊 Found ${productionFiles.length} files in production\n`);

    // Sync each file
    let successCount = 0;
    let failureCount = 0;
    const failedFiles = [];

    console.log("📤 Starting file sync...\n");

    for (const file of productionFiles) {
      console.log(`📄 Syncing: ${file.filename}`);
      console.log(`   Type: ${file.type}`);
      console.log(`   Original URL: ${file.url}`);

      const result = await createFileInStaging(file);

      if (result.success) {
        successCount++;
        console.log(`   ✅ Success`);
        console.log(`   New URL: ${result.url}`);

        // Check if file extension changed
        const originalExt = file.filename.split(".").pop().toLowerCase();
        const newFilename = result.url.split("/").pop().split("?")[0];
        const newExt = newFilename.split(".").pop().toLowerCase();

        if (originalExt !== newExt) {
          console.log(`   ⚠️  Format changed: ${originalExt} → ${newExt}`);
        }
      } else {
        failureCount++;
        failedFiles.push({ filename: file.filename, error: result.error });
        console.log(`   ❌ Failed: ${result.error}`);
      }
      console.log("");
    }

    // Summary
    console.log("\n📊 Sync Summary:");
    console.log(`✅ Successfully synced: ${successCount} files`);
    console.log(`❌ Failed: ${failureCount} files`);

    if (failedFiles.length > 0) {
      console.log("\n❌ Failed files:");
      failedFiles.forEach((f) => {
        console.log(`   - ${f.filename}: ${f.error}`);
      });
    }

    console.log("\n✨ Sync complete!");
  } catch (error) {
    console.error("\n❌ Sync failed:", error.message);
    process.exit(1);
  }
}

// Run the sync
syncFiles();

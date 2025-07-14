#!/usr/bin/env node

/**
 * Sync Images with Duplicate Check
 * This script syncs image files from one store to another, checking for duplicates first
 */

const https = require("https");
const path = require("path");

// Configuration
const config = {
  source: {
    store: process.env.SOURCE_STORE || "source-store.myshopify.com",
    accessToken: process.env.SOURCE_ACCESS_TOKEN || "source-access-token",
  },
  target: {
    store: process.env.TARGET_STORE || "target-store.myshopify.com",
    accessToken: process.env.TARGET_ACCESS_TOKEN || "target-access-token",
  },
  apiVersion: "2025-01",
};

/**
 * GraphQL query to fetch images from source
 */
const mediaQuery = `
  query getMedia($cursor: String) {
    files(first: 50, after: $cursor, query: "media_type:IMAGE") {
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
 * GraphQL query to check if file exists in target by filename
 */
const checkFileExistsQuery = `
  query checkFileExists($query: String!) {
    files(first: 10, query: $query) {
      edges {
        node {
          ... on MediaImage {
            id
            image {
              url
            }
          }
        }
      }
    }
  }
`;

/**
 * GraphQL mutation to create file in target
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
 * Extract base filename without extension and size suffix
 * e.g., "product-image_1024x1024.jpg" -> "product-image"
 */
function getBaseFilename(filename) {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  // Remove common Shopify size suffixes for images
  let baseName = nameWithoutExt.replace(/_\d+x\d+$/, "");
  return baseName;
}

/**
 * Check if image exists in target store
 */
async function checkImageExists(filename) {
  try {
    const baseFilename = getBaseFilename(filename);
    // Search for files with similar names
    const searchQuery = `filename:${baseFilename}*`;

    const data = await makeGraphQLRequest(
      config.target.store,
      config.target.accessToken,
      checkFileExistsQuery,
      { query: searchQuery }
    );

    return data.files.edges.length > 0;
  } catch (error) {
    console.error(`Error checking if image exists: ${error.message}`);
    return false;
  }
}

/**
 * Fetch all images from source
 */
async function fetchSourceImages(cursor = null) {
  const allImages = [];

  try {
    const data = await makeGraphQLRequest(
      config.source.store,
      config.source.accessToken,
      mediaQuery,
      { cursor }
    );

    const mediaFiles = data.files.edges;

    for (const edge of mediaFiles) {
      const node = edge.node;

      // Handle images
      if (node.image) {
        allImages.push({
          type: "IMAGE",
          url: node.image.url,
          alt: node.alt || "",
          filename: getFilenameFromUrl(node.image.url),
          width: node.image.width,
          height: node.image.height,
        });
      }
    }

    // Recursively fetch next page
    if (data.files.pageInfo.hasNextPage && mediaFiles.length > 0) {
      const lastCursor = mediaFiles[mediaFiles.length - 1].cursor;
      const nextImages = await fetchSourceImages(lastCursor);
      allImages.push(...nextImages);
    }

    return allImages;
  } catch (error) {
    console.error("Error fetching images:", error.message);
    throw error;
  }
}

/**
 * Create image in target store
 */
async function createImageInTarget(imageInfo) {
  try {
    const fileCreateInput = {
      files: [
        {
          alt: imageInfo.alt || imageInfo.filename,
          contentType: "IMAGE",
          originalSource: imageInfo.url,
          filename: imageInfo.filename,
        },
      ],
    };

    const data = await makeGraphQLRequest(
      config.target.store,
      config.target.accessToken,
      fileCreateMutation,
      fileCreateInput
    );

    if (data.fileCreate.userErrors.length > 0) {
      throw new Error(JSON.stringify(data.fileCreate.userErrors));
    }

    const createdFile = data.fileCreate.files[0];
    let url = "URL not available";

    if (createdFile.image?.url) {
      url = createdFile.image.url;
    }

    return {
      success: true,
      url: url,
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
async function syncImages() {
  try {
    console.log("🔄 Image Sync with Duplicate Check\n");
    console.log(`📍 Source: ${config.source.store}`);
    console.log(`📍 Target: ${config.target.store}\n`);

    // Fetch all images from source
    console.log("📥 Fetching images from source store...");
    const sourceImages = await fetchSourceImages();

    console.log(`📊 Found ${sourceImages.length} images\n`);

    // Sync each image
    let successCount = 0;
    let skippedCount = 0;
    let failureCount = 0;
    const results = {
      synced: [],
      skipped: [],
      failed: [],
    };

    console.log("📤 Starting image sync...\n");

    for (const image of sourceImages) {
      process.stdout.write(`🖼️  Checking: ${image.filename}... `);

      // Check if image already exists
      const exists = await checkImageExists(image.filename);

      if (exists) {
        skippedCount++;
        results.skipped.push({
          filename: image.filename,
          type: "IMAGE",
        });
        console.log("⏭️  Skipped (already exists)");
      } else {
        const result = await createImageInTarget(image);

        if (result.success) {
          successCount++;
          results.synced.push({
            filename: image.filename,
            type: "IMAGE",
            url: result.url,
          });
          console.log("✅ Synced");
        } else {
          failureCount++;
          results.failed.push({
            filename: image.filename,
            type: "IMAGE",
            error: result.error,
          });
          console.log(`❌ Failed: ${result.error}`);
        }
      }
    }

    // Summary
    console.log("\n📊 Sync Summary:");
    console.log(`✅ Successfully synced: ${successCount} images`);
    console.log(`⏭️  Skipped (duplicates): ${skippedCount} images`);
    console.log(`❌ Failed: ${failureCount} images`);

    // Output results as JSON for GitHub Actions
    if (process.env.GITHUB_OUTPUT) {
      const fs = require("fs");
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `synced_count=${successCount}\n`
      );
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `skipped_count=${skippedCount}\n`
      );
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `failed_count=${failureCount}\n`
      );
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `synced_images=${successCount}\n`
      );
      fs.appendFileSync(process.env.GITHUB_OUTPUT, `synced_videos=0\n`);
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `results=${JSON.stringify(results)}\n`
      );
    }

    if (results.failed.length > 0) {
      console.log("\n❌ Failed files:");
      results.failed.forEach((f) => {
        console.log(`   🖼️ ${f.filename}: ${f.error}`);
      });
    }

    console.log("\n✨ Sync complete!");
    return results;
  } catch (error) {
    console.error("\n❌ Sync failed:", error.message);
    process.exit(1);
  }
}

// Run the sync if called directly
if (require.main === module) {
  syncImages();
}

module.exports = { syncImages };

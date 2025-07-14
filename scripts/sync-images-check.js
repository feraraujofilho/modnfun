#!/usr/bin/env node

/**
 * Sync Images and Videos with Duplicate Check
 * This script syncs media files (images and videos) from one store to another, checking for duplicates first
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
 * GraphQL query to fetch images and videos from source
 */
const mediaQuery = `
  query getMedia($cursor: String) {
    files(first: 50, after: $cursor, query: "media_type:IMAGE OR media_type:VIDEO") {
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
          ... on Video {
            id
            originalSource {
              url
            }
            sources {
              url
              format
              mimeType
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
        ... on Video {
          originalSource {
            url
          }
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
 * Extract base filename without extension and size suffix
 * e.g., "product-image_1024x1024.jpg" -> "product-image"
 * e.g., "product-video_hd.mp4" -> "product-video"
 */
function getBaseFilename(filename) {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, "");
  // Remove common Shopify size suffixes for images
  let baseName = nameWithoutExt.replace(/_\d+x\d+$/, "");
  // Remove common video quality suffixes
  baseName = baseName.replace(/_(hd|sd|720p|1080p|4k)$/i, "");
  return baseName;
}

/**
 * Check if media file exists in target store
 */
async function checkMediaExists(filename) {
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
    console.error(`Error checking if media exists: ${error.message}`);
    return false;
  }
}

/**
 * Fetch all media files from source
 */
async function fetchSourceMedia(cursor = null) {
  const allMedia = [];

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
        allMedia.push({
          type: "IMAGE",
          url: node.image.url,
          alt: node.alt || "",
          filename: getFilenameFromUrl(node.image.url),
          width: node.image.width,
          height: node.image.height,
        });
      }

      // Handle videos
      if (node.originalSource) {
        allMedia.push({
          type: "VIDEO",
          url: node.originalSource.url,
          alt: node.alt || "",
          filename: getFilenameFromUrl(node.originalSource.url),
        });
      }
    }

    // Recursively fetch next page
    if (data.files.pageInfo.hasNextPage && mediaFiles.length > 0) {
      const lastCursor = mediaFiles[mediaFiles.length - 1].cursor;
      const nextMedia = await fetchSourceMedia(lastCursor);
      allMedia.push(...nextMedia);
    }

    return allMedia;
  } catch (error) {
    console.error("Error fetching media:", error.message);
    throw error;
  }
}

/**
 * Create media file in target store
 */
async function createMediaInTarget(mediaInfo) {
  try {
    const fileCreateInput = {
      files: [
        {
          alt: mediaInfo.alt || mediaInfo.filename,
          contentType: mediaInfo.type,
          originalSource: mediaInfo.url,
          filename: mediaInfo.filename,
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
    } else if (createdFile.originalSource?.url) {
      url = createdFile.originalSource.url;
    } else if (createdFile.sources && createdFile.sources[0]?.url) {
      url = createdFile.sources[0].url;
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
async function syncMedia() {
  try {
    console.log("🔄 Media Sync with Duplicate Check (Images & Videos)\n");
    console.log(`📍 Source: ${config.source.store}`);
    console.log(`📍 Target: ${config.target.store}\n`);

    // Fetch all media from source
    console.log("📥 Fetching media files from source store...");
    const sourceMedia = await fetchSourceMedia();

    // Count by type
    const imageCount = sourceMedia.filter((m) => m.type === "IMAGE").length;
    const videoCount = sourceMedia.filter((m) => m.type === "VIDEO").length;

    console.log(`📊 Found ${sourceMedia.length} media files:`);
    console.log(`   🖼️  Images: ${imageCount}`);
    console.log(`   🎬 Videos: ${videoCount}\n`);

    // Sync each media file
    let successCount = 0;
    let skippedCount = 0;
    let failureCount = 0;
    const results = {
      synced: [],
      skipped: [],
      failed: [],
    };

    console.log("📤 Starting media sync...\n");

    for (const media of sourceMedia) {
      const icon = media.type === "IMAGE" ? "🖼️" : "🎬";
      process.stdout.write(`${icon}  Checking: ${media.filename}... `);

      // Check if media already exists
      const exists = await checkMediaExists(media.filename);

      if (exists) {
        skippedCount++;
        results.skipped.push({
          filename: media.filename,
          type: media.type,
        });
        console.log("⏭️  Skipped (already exists)");
      } else {
        const result = await createMediaInTarget(media);

        if (result.success) {
          successCount++;
          results.synced.push({
            filename: media.filename,
            type: media.type,
            url: result.url,
          });
          console.log("✅ Synced");
        } else {
          failureCount++;
          results.failed.push({
            filename: media.filename,
            type: media.type,
            error: result.error,
          });
          console.log(`❌ Failed: ${result.error}`);
        }
      }
    }

    // Summary
    console.log("\n📊 Sync Summary:");
    console.log(`✅ Successfully synced: ${successCount} files`);
    console.log(`⏭️  Skipped (duplicates): ${skippedCount} files`);
    console.log(`❌ Failed: ${failureCount} files`);

    // Breakdown by type
    const syncedImages = results.synced.filter(
      (f) => f.type === "IMAGE"
    ).length;
    const syncedVideos = results.synced.filter(
      (f) => f.type === "VIDEO"
    ).length;
    const skippedImages = results.skipped.filter(
      (f) => f.type === "IMAGE"
    ).length;
    const skippedVideos = results.skipped.filter(
      (f) => f.type === "VIDEO"
    ).length;

    console.log("\n📊 Breakdown by type:");
    console.log(
      `   🖼️  Images: ${syncedImages} synced, ${skippedImages} skipped`
    );
    console.log(
      `   🎬 Videos: ${syncedVideos} synced, ${skippedVideos} skipped`
    );

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
        `synced_images=${syncedImages}\n`
      );
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `synced_videos=${syncedVideos}\n`
      );
      fs.appendFileSync(
        process.env.GITHUB_OUTPUT,
        `results=${JSON.stringify(results)}\n`
      );
    }

    if (results.failed.length > 0) {
      console.log("\n❌ Failed files:");
      results.failed.forEach((f) => {
        const icon = f.type === "IMAGE" ? "🖼️" : "🎬";
        console.log(`   ${icon} ${f.filename}: ${f.error}`);
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
  syncMedia();
}

module.exports = { syncMedia };

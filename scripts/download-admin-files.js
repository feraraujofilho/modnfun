#!/usr/bin/env node

/**
 * Download Shopify Admin Files
 * This script downloads all files from Content > Files in Shopify Admin
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// Configuration
const config = {
  store: process.env.SHOPIFY_STORE || "your-store.myshopify.com",
  accessToken: process.env.SHOPIFY_ACCESS_TOKEN || "your-access-token",
  apiVersion: "2025-01",
};

/**
 * GraphQL query to fetch files
 */
const filesQuery = `
  query getFiles($cursor: String) {
    files(first: 50, after: $cursor) {
      edges {
        node {
          alt
          createdAt
          fileStatus
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
 * Make GraphQL request
 */
function makeGraphQLRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });

    const options = {
      hostname: config.store.replace("https://", "").replace("http://", ""),
      path: `/admin/api/${config.apiVersion}/graphql.json`,
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": config.accessToken,
        "Content-Type": "application/json",
        "Content-Length": data.length,
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
 * Download file from URL
 */
function downloadFile(url, filename) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(filename);
    https
      .get(url, (response) => {
        response.pipe(file);
        file.on("finish", () => {
          file.close();
          resolve();
        });
      })
      .on("error", (err) => {
        fs.unlink(filename, () => {});
        reject(err);
      });
  });
}

/**
 * Extract filename from URL
 */
function getFilenameFromUrl(url) {
  const urlObj = new URL(url);
  const pathname = urlObj.pathname;
  const filename = path.basename(pathname);
  return filename || "unnamed-file";
}

/**
 * Fetch all files recursively
 */
async function fetchAllFiles(cursor = null) {
  const allFiles = [];

  try {
    const data = await makeGraphQLRequest(filesQuery, { cursor });
    const files = data.files.edges;

    for (const edge of files) {
      const node = edge.node;
      let fileInfo = {
        id: node.id,
        alt: node.alt,
        createdAt: node.createdAt,
        status: node.fileStatus,
      };

      if (node.image) {
        fileInfo.url = node.image.url;
        fileInfo.type = "image";
      } else if (node.url) {
        fileInfo.url = node.url;
        fileInfo.type = "generic";
      } else if (node.originalSource) {
        fileInfo.url = node.originalSource.url;
        fileInfo.type = "video";
      }

      if (fileInfo.url) {
        allFiles.push(fileInfo);
      }
    }

    // Recursively fetch next page
    if (data.files.pageInfo.hasNextPage) {
      const lastCursor = files[files.length - 1].cursor;
      const nextFiles = await fetchAllFiles(lastCursor);
      allFiles.push(...nextFiles);
    }

    return allFiles;
  } catch (error) {
    console.error("Error fetching files:", error.message);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    console.log("Fetching files from Shopify Admin...\n");

    // Create downloads directory
    const downloadDir = "shopify-admin-files";
    if (!fs.existsSync(downloadDir)) {
      fs.mkdirSync(downloadDir);
    }

    // Fetch all files
    const files = await fetchAllFiles();
    console.log(`Found ${files.length} files\n`);

    // Download each file
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const filename = getFilenameFromUrl(file.url);
      const filepath = path.join(downloadDir, filename);

      console.log(`[${i + 1}/${files.length}] Downloading: ${filename}`);

      try {
        await downloadFile(file.url, filepath);
        console.log(`  ✓ Saved to: ${filepath}`);
      } catch (err) {
        console.error(`  ✗ Error: ${err.message}`);
      }
    }

    console.log(`\n✅ Download complete! Files saved to: ${downloadDir}/`);

    // Save metadata
    const metadataPath = path.join(downloadDir, "files-metadata.json");
    fs.writeFileSync(metadataPath, JSON.stringify(files, null, 2));
    console.log(`📄 Metadata saved to: ${metadataPath}`);
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Run the script
main();

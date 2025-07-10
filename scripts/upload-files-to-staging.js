#!/usr/bin/env node

/**
 * Upload Files to Staging Store
 * This script uploads files to a Shopify store using the GraphQL API
 */

const https = require("https");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");

// Configuration
const config = {
  store: process.env.STAGING_STORE || "your-staging-store.myshopify.com",
  accessToken: process.env.STAGING_ACCESS_TOKEN || "your-staging-access-token",
  apiVersion: "2025-01",
};

/**
 * GraphQL mutation to create staged upload
 */
const stagedUploadMutation = `
  mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters {
          name
          value
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
 * GraphQL mutation to create file
 */
const fileCreateMutation = `
  mutation fileCreate($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        alt
        createdAt
        ... on MediaImage {
          image {
            url
          }
        }
        ... on GenericFile {
          url
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
 * Get MIME type from file extension
 */
function getMimeType(filename) {
  const ext = path.extname(filename).toLowerCase();
  const mimeTypes = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".svg": "image/svg+xml",
    ".webp": "image/webp",
    ".mp4": "video/mp4",
    ".pdf": "application/pdf",
    ".csv": "text/csv",
    ".avif": "image/avif",
  };
  return mimeTypes[ext] || "application/octet-stream";
}

/**
 * Make GraphQL request
 */
function makeGraphQLRequest(query, variables = {}) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ query, variables });

    console.log(
      `  → GraphQL Request to: https://${config.store}/admin/api/${config.apiVersion}/graphql.json`
    );

    const options = {
      hostname: config.store.replace("https://", "").replace("http://", ""),
      path: `/admin/api/${config.apiVersion}/graphql.json`,
      method: "POST",
      headers: {
        "X-Shopify-Access-Token": config.accessToken,
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
            console.error(
              "  ✗ GraphQL Errors:",
              JSON.stringify(parsed.errors, null, 2)
            );
            reject(new Error(JSON.stringify(parsed.errors)));
          } else {
            resolve(parsed.data);
          }
        } catch (e) {
          console.error("  ✗ Parse Error:", e.message);
          console.error("  ✗ Response:", responseData);
          reject(e);
        }
      });
    });

    req.on("error", (err) => {
      console.error("  ✗ Request Error:", err.message);
      reject(err);
    });

    req.write(data);
    req.end();
  });
}

/**
 * Upload file using fetch (requires Node 18+)
 */
async function uploadToStagedUrl(stagedTarget, filePath) {
  try {
    const FormData = require("form-data");
    const form = new FormData();

    // Add parameters first
    stagedTarget.parameters.forEach((param) => {
      form.append(param.name, param.value);
    });

    // Add file last
    const fileStream = fs.createReadStream(filePath);
    form.append("file", fileStream, path.basename(filePath));

    console.log(`  → Uploading to: ${stagedTarget.url.substring(0, 50)}...`);

    return new Promise((resolve, reject) => {
      const url = new URL(stagedTarget.url);

      const options = {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method: "POST",
        headers: form.getHeaders(),
      };

      const req = https.request(options, (res) => {
        let responseData = "";
        res.on("data", (chunk) => (responseData += chunk));
        res.on("end", () => {
          console.log(`  → Upload response status: ${res.statusCode}`);
          if (
            res.statusCode === 201 ||
            res.statusCode === 200 ||
            res.statusCode === 204
          ) {
            resolve(stagedTarget.resourceUrl);
          } else {
            console.error(`  ✗ Upload failed with status ${res.statusCode}`);
            console.error(`  ✗ Response: ${responseData}`);
            reject(new Error(`Upload failed: ${res.statusCode}`));
          }
        });
      });

      req.on("error", (err) => {
        console.error("  ✗ Upload request error:", err.message);
        reject(err);
      });

      form.pipe(req);
    });
  } catch (error) {
    console.error("  ✗ Upload error:", error.message);
    throw error;
  }
}

/**
 * Upload a single file
 */
async function uploadFile(filePath, alt = "") {
  try {
    const filename = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;
    const mimeType = getMimeType(filename);

    console.log(
      `Uploading: ${filename} (${(fileSize / 1024 / 1024).toFixed(
        2
      )} MB, ${mimeType})`
    );

    // Step 1: Create staged upload
    const stagedUploadInput = {
      input: [
        {
          filename: filename,
          mimeType: mimeType,
          resource: "FILE",
          fileSize: fileSize.toString(),
        },
      ],
    };

    console.log("  → Creating staged upload...");
    const stagedData = await makeGraphQLRequest(
      stagedUploadMutation,
      stagedUploadInput
    );

    if (!stagedData || !stagedData.stagedUploadsCreate) {
      throw new Error("Invalid staged upload response");
    }

    if (stagedData.stagedUploadsCreate.userErrors.length > 0) {
      throw new Error(
        `Staged upload errors: ${JSON.stringify(
          stagedData.stagedUploadsCreate.userErrors
        )}`
      );
    }

    const stagedTarget = stagedData.stagedUploadsCreate.stagedTargets[0];
    console.log("  ✓ Staged upload created");

    // Step 2: Upload file to staged URL
    console.log("  → Uploading file to staged URL...");
    const resourceUrl = await uploadToStagedUrl(stagedTarget, filePath);
    console.log("  ✓ File uploaded to staged URL");

    // Step 3: Create file in Shopify
    console.log("  → Creating file in Shopify...");
    const fileCreateInput = {
      files: [
        {
          alt: alt || filename,
          contentType: "FILE",
          originalSource: resourceUrl,
        },
      ],
    };

    const fileData = await makeGraphQLRequest(
      fileCreateMutation,
      fileCreateInput
    );

    if (!fileData || !fileData.fileCreate) {
      throw new Error("Invalid file create response");
    }

    if (fileData.fileCreate.userErrors.length > 0) {
      throw new Error(
        `File create errors: ${JSON.stringify(fileData.fileCreate.userErrors)}`
      );
    }

    const createdFile = fileData.fileCreate.files[0];
    const fileUrl =
      createdFile.image?.url || createdFile.url || "URL not available";

    console.log(`  ✓ File created successfully`);
    console.log(`  → File URL: ${fileUrl}`);

    return createdFile;
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Check if form-data is available
 */
function checkDependencies() {
  try {
    require("form-data");
    return true;
  } catch (e) {
    console.error("\n❌ Missing required dependency: form-data");
    console.error("Please install it by running:");
    console.error("  npm install form-data\n");
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Check dependencies
    if (!checkDependencies()) {
      process.exit(1);
    }

    // Check configuration
    if (config.accessToken === "your-staging-access-token") {
      console.error(
        "\n❌ Error: Please set the STAGING_ACCESS_TOKEN environment variable"
      );
      console.error("Example:");
      console.error('  export STAGING_ACCESS_TOKEN="shpat_xxxxx"');
      console.error('  export STAGING_STORE="your-store.myshopify.com"\n');
      process.exit(1);
    }

    const uploadDir = process.argv[2] || "shopify-admin-files";

    if (!fs.existsSync(uploadDir)) {
      console.error(`\n❌ Directory not found: ${uploadDir}`);
      console.log("\nUsage: node upload-files-to-staging.js [directory]\n");
      process.exit(1);
    }

    console.log(`\n📤 Uploading files to: ${config.store}`);
    console.log(`📁 From directory: ${uploadDir}\n`);

    // Get all files in directory
    const files = fs
      .readdirSync(uploadDir)
      .filter((file) => !file.endsWith(".json")) // Skip metadata files
      .map((file) => path.join(uploadDir, file));

    console.log(`Found ${files.length} files to upload\n`);

    // Upload each file
    let successCount = 0;
    const failedFiles = [];

    for (let i = 0; i < files.length; i++) {
      console.log(`\n[${i + 1}/${files.length}]`);
      try {
        await uploadFile(files[i]);
        successCount++;
      } catch (err) {
        failedFiles.push({ file: files[i], error: err.message });
      }
    }

    console.log(`\n${"=".repeat(60)}`);
    console.log(
      `✅ Upload complete! ${successCount}/${files.length} files uploaded successfully`
    );

    if (failedFiles.length > 0) {
      console.log(`\n❌ Failed uploads (${failedFiles.length}):`);
      failedFiles.forEach(({ file, error }) => {
        console.log(`  - ${path.basename(file)}: ${error}`);
      });
    }
  } catch (error) {
    console.error("\n❌ Fatal error:", error.message);
    process.exit(1);
  }
}

// Run the script
main();

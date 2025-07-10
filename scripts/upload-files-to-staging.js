#!/usr/bin/env node

/**
 * Upload Files to Staging Store
 * This script uploads files to a Shopify store using the GraphQL API
 */

const https = require("https");
const fs = require("fs");
const path = require("path");

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
 * Upload file to staged URL
 */
function uploadToStagedUrl(stagedTarget, filePath) {
  return new Promise((resolve, reject) => {
    const fileStream = fs.createReadStream(filePath);
    const fileSize = fs.statSync(filePath).size;

    // Build form data
    const boundary = "----FormBoundary" + Date.now();
    let formData = "";

    // Add parameters
    stagedTarget.parameters.forEach((param) => {
      formData += `--${boundary}\r\n`;
      formData += `Content-Disposition: form-data; name="${param.name}"\r\n\r\n`;
      formData += `${param.value}\r\n`;
    });

    // Add file
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="file"; filename="${path.basename(
      filePath
    )}"\r\n`;
    formData += `Content-Type: application/octet-stream\r\n\r\n`;

    const formDataEnd = `\r\n--${boundary}--\r\n`;

    const url = new URL(stagedTarget.url);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: "POST",
      headers: {
        "Content-Type": `multipart/form-data; boundary=${boundary}`,
        "Content-Length":
          Buffer.byteLength(formData) +
          fileSize +
          Buffer.byteLength(formDataEnd),
      },
    };

    const req = https.request(options, (res) => {
      let responseData = "";
      res.on("data", (chunk) => (responseData += chunk));
      res.on("end", () => {
        if (res.statusCode === 201 || res.statusCode === 200) {
          resolve(stagedTarget.resourceUrl);
        } else {
          reject(
            new Error(`Upload failed: ${res.statusCode} - ${responseData}`)
          );
        }
      });
    });

    req.on("error", reject);

    // Write form data
    req.write(formData);

    // Pipe file
    fileStream.on("data", (chunk) => req.write(chunk));
    fileStream.on("end", () => {
      req.write(formDataEnd);
      req.end();
    });
  });
}

/**
 * Upload a single file
 */
async function uploadFile(filePath, alt = "") {
  try {
    const filename = path.basename(filePath);
    const fileSize = fs.statSync(filePath).size;

    console.log(
      `Uploading: ${filename} (${(fileSize / 1024 / 1024).toFixed(2)} MB)`
    );

    // Step 1: Create staged upload
    const stagedUploadInput = {
      input: [
        {
          filename: filename,
          mimeType: "application/octet-stream",
          resource: "FILE",
          fileSize: fileSize.toString(),
        },
      ],
    };

    const stagedData = await makeGraphQLRequest(
      stagedUploadMutation,
      stagedUploadInput
    );

    if (stagedData.stagedUploadsCreate.userErrors.length > 0) {
      throw new Error(
        JSON.stringify(stagedData.stagedUploadsCreate.userErrors)
      );
    }

    const stagedTarget = stagedData.stagedUploadsCreate.stagedTargets[0];

    // Step 2: Upload file to staged URL
    const resourceUrl = await uploadToStagedUrl(stagedTarget, filePath);
    console.log(`  ✓ Uploaded to staged URL`);

    // Step 3: Create file in Shopify
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

    if (fileData.fileCreate.userErrors.length > 0) {
      throw new Error(JSON.stringify(fileData.fileCreate.userErrors));
    }

    console.log(`  ✓ File created successfully`);
    return fileData.fileCreate.files[0];
  } catch (error) {
    console.error(`  ✗ Error: ${error.message}`);
    throw error;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    const uploadDir = process.argv[2] || "shopify-admin-files";

    if (!fs.existsSync(uploadDir)) {
      console.error(`Directory not found: ${uploadDir}`);
      console.log("\nUsage: node upload-files-to-staging.js [directory]");
      process.exit(1);
    }

    console.log(`Uploading files from: ${uploadDir}\n`);

    // Get all files in directory
    const files = fs
      .readdirSync(uploadDir)
      .filter((file) => !file.endsWith(".json")) // Skip metadata files
      .map((file) => path.join(uploadDir, file));

    console.log(`Found ${files.length} files to upload\n`);

    // Upload each file
    let successCount = 0;
    for (let i = 0; i < files.length; i++) {
      console.log(`[${i + 1}/${files.length}]`);
      try {
        await uploadFile(files[i]);
        successCount++;
      } catch (err) {
        // Continue with next file
      }
      console.log("");
    }

    console.log(
      `✅ Upload complete! ${successCount}/${files.length} files uploaded successfully`
    );
  } catch (error) {
    console.error("Error:", error.message);
    process.exit(1);
  }
}

// Run the script
main();

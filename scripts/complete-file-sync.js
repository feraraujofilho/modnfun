#!/usr/bin/env node

/**
 * Complete File Sync Script
 * This script runs the full sync process including URL replacement
 */

const { execSync } = require("child_process");

console.log("🚀 Starting Complete File Sync Process\n");

try {
  // Step 1: Sync files from production to staging
  console.log("Step 1: Syncing files from production to staging...");
  execSync("node sync-files-direct.js", { stdio: "inherit" });

  console.log("\n✅ File sync completed!");

  // Step 2: Wait a bit for files to be processed
  console.log("\nStep 2: Waiting for file processing...");
  console.log("⏳ Waiting 10 seconds for Shopify to process files...");
  execSync("sleep 10", { stdio: "inherit" });

  // Step 3: Replace shopify:// URLs with CDN URLs
  console.log("\nStep 3: Replacing shopify:// URLs with CDN URLs...");
  execSync("node replace-shopify-urls.js", { stdio: "inherit" });

  console.log("\n🎉 Complete sync process finished!");
  console.log("\n📝 Next steps:");
  console.log("1. Review the changes made to your theme files");
  console.log("2. Push the theme changes to Shopify:");
  console.log("   cd .. && shopify theme push");
  console.log(
    "\n💡 Note: The theme push will update your staging theme with the new URLs"
  );
} catch (error) {
  console.error("\n❌ Error during sync process:", error.message);
  process.exit(1);
}

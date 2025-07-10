#!/usr/bin/env node

/**
 * Complete File Sync
 * This script syncs all Admin files from production to staging
 */

const { spawn } = require("child_process");

async function main() {
  try {
    console.log("🔄 Admin Files Sync: Production → Staging\n");

    const child = spawn("node", ["scripts/sync-files-direct.js"], {
      env: process.env,
      stdio: "inherit",
    });

    child.on("close", (code) => {
      if (code !== 0) {
        console.error("\n❌ Sync failed with code:", code);
        process.exit(code);
      } else {
        console.log("\n✅ Sync complete!");
        console.log(
          "\n💡 Note: Files using shopify:// references will work automatically"
        );
        console.log(
          "   Just make sure to refresh your theme editor if needed.\n"
        );
      }
    });

    child.on("error", (err) => {
      console.error("\n❌ Error:", err.message);
      process.exit(1);
    });
  } catch (error) {
    console.error("\n❌ Error:", error.message);
    process.exit(1);
  }
}

// Run the sync
main();

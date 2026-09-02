// Run with: node scripts/testCleanup.js
const trackingCleanupService = require("../services/trackingCleanupService");

(async () => {
  console.log("=== Testing Tracking Cleanup Service ===\n");

  try {
    // 1. Get current stats
    console.log("📊 Current Database Stats:");
    const stats = await trackingCleanupService.getCleanupStats();
    console.log(`   Total records: ${stats.totalTrackingRecords}`);
    console.log(`   Active journeys: ${stats.activeJourneysCount}`);
    console.log(`   Records >7 days old: ${stats.recordsOlderThan7Days}`);
    console.log(`   Oldest record: ${stats.oldestRecordTimestamp}`);
    console.log(`   Newest record: ${stats.newestRecordTimestamp}\n`);

    // 2. Dry run (see what would be deleted)
    console.log("🔍 Dry Run (preview what will be deleted):");
    const dryRun = await trackingCleanupService.dryRunCleanup();
    console.log(`   Active buses: ${dryRun.activeBusCount}`);
    console.log(`   Records to keep: ${dryRun.recordsToKeep}`);
    console.log(`   Records to delete: ${dryRun.recordsToDelete}\n`);

    // 3. Ask for confirmation
    if (dryRun.recordsToDelete > 0) {
      console.log(`⚠️  This will DELETE ${dryRun.recordsToDelete} records.`);
      console.log("To actually run cleanup, uncomment the line below.\n");
      // const result = await trackingCleanupService.cleanupCompletedJourneys();
      // console.log("✅ Cleanup completed:", result);
    } else {
      console.log("✅ No records to delete. Database is clean!\n");
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
  }

  process.exit(0);
})();

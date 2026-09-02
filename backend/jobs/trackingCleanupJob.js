const cron = require("node-cron");
const trackingCleanupService = require("../services/trackingCleanupService");
const logAudit = require("../utils/logAudit");

class TrackingCleanupJob {
  constructor() {
    this.isRunning = false;
    this.lastRunTime = null; // Add this line
  }

  start() {
    cron.schedule("0 0 * * *", async () => {
      await this.runCleanup();
    });

    console.log("[CleanupJob] Scheduled to run daily at midnight");

    logAudit({
      userId: null,
      action: "job_scheduled",
      entity: "System",
      entityId: "tracking_cleanup",
      metadata: {
        schedule: "0 0 * * *",
        message: "Tracking cleanup job scheduled successfully",
        timestamp: new Date().toISOString(),
      },
    }).catch(() => {});
  }

  async runCleanup() {
    if (this.isRunning) {
      console.log("[CleanupJob] Cleanup already running, skipping...");

      await logAudit({
        userId: null,
        action: "cleanup_skipped",
        entity: "Tracking",
        entityId: "system",
        metadata: {
          reason: "Previous cleanup still running",
          lastRunTime: this.lastRunTime,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {});
      return;
    }

    this.isRunning = true;
    this.lastRunTime = new Date(); // Set the run time

    console.log(
      "[CleanupJob] Starting scheduled cleanup at",
      this.lastRunTime.toISOString(),
    );

    await logAudit({
      userId: null,
      action: "cleanup_started",
      entity: "Tracking",
      entityId: "system",
      metadata: {
        startTime: this.lastRunTime.toISOString(),
        scheduledRun: true,
      },
    }).catch(() => {});

    try {
      const result = await trackingCleanupService.cleanupCompletedJourneys();

      console.log("[CleanupJob] Cleanup completed successfully:", result);
    } catch (error) {
      console.error("[CleanupJob] Cleanup failed:", error);

      await logAudit({
        userId: null,
        action: "cleanup_failed",
        entity: "Tracking",
        entityId: "system",
        metadata: {
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {});
    } finally {
      this.isRunning = false;
    }
  }
}

module.exports = new TrackingCleanupJob();

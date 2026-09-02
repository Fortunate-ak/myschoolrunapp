// services/trackingCleanupService.js
const db = require("../models/index");
const { Op } = require("sequelize");
const logAudit = require("../utils/logAudit");

class TrackingCleanupService {
  /**
   * Clean up completed journey records from vehicle tracking
   * Only deletes records that are not part of an active journey
   */
  async cleanupCompletedJourneys() {
    const startTime = Date.now();

    try {
      console.log(
        "[CleanupService] Starting cleanup of completed journey records...",
      );

      // 1. Find all vehicles that have ACTIVE tracking updates in the last 30 minutes
      // These vehicles are considered to be on an active journey
      const activeCutoffTime = new Date(Date.now() - 30 * 60 * 1000);

      const activeVehiclees = await db.vehicletracking.findAll({
        attributes: ["vehicleId"],
        where: {
          timestamp: {
            [Op.gte]: activeCutoffTime,
          },
        },
        group: ["vehicleId"],
        raw: true,
      });

      const activeVehicleIds = activeVehiclees.map((b) => b.vehicleId);

      console.log(
        `[CleanupService] Found ${activeVehicleIds.length} vehicles with active journeys`,
      );

      // Get vehicle details for audit logging
      let activeVehicleDetails = [];
      if (activeVehicleIds.length > 0) {
        const vehicles = await db.vehicles.findAll({
          where: { id: { [Op.in]: activeVehicleIds } },
          attributes: ["id", "vehicleNumber", "registrationNumber"],
          raw: true,
        });
        activeVehicleDetails = vehicles;
      }

      // Count records before deletion
      const totalRecordsBefore = await db.vehicletracking.count();

      let deletedCount = 0;
      let keptCount = 0;

      // Start transaction for safe deletion
      const transaction = await db.sequelize.transaction();

      try {
        if (activeVehicleIds.length > 0) {
          // For active vehicles: keep ONLY the latest record for each vehicle
          for (const vehicleId of activeVehicleIds) {
            // Get the latest tracking record ID for this vehicle
            const latestRecord = await db.vehicletracking.findOne({
              where: { vehicleId },
              order: [["timestamp", "DESC"]],
              attributes: ["id"],
              raw: true,
              transaction,
            });

            if (latestRecord) {
              // Delete all other records for this vehicle (older ones)
              const deleted = await db.vehicletracking.destroy({
                where: {
                  vehicleId: vehicleId,
                  id: { [Op.ne]: latestRecord.id },
                },
                transaction,
              });
              deletedCount += deleted;
              keptCount += 1; // Keep the latest record
            }
          }

          // Delete ALL records from inactive vehicles (vehicles with no recent updates)
          if (activeVehicleIds.length > 0) {
            const inactiveDeleted = await db.vehicletracking.destroy({
              where: {
                vehicleId: { [Op.notIn]: activeVehicleIds },
              },
              transaction,
            });
            deletedCount += inactiveDeleted;
          }
        } else {
          // No active vehicles - delete everything
          deletedCount = await db.vehicletracking.destroy({
            where: {},
            transaction,
          });
          keptCount = 0;
        }

        await transaction.commit();
      } catch (error) {
        await transaction.rollback();
        throw error;
      }

      const recordsAfter = await db.vehicletracking.count();
      const duration = Date.now() - startTime;

      const result = {
        success: true,
        deletedCount: deletedCount,
        keptCount: keptCount,
        activeVehicleCount: activeVehicleIds.length,
        activeVehicleDetails: activeVehicleDetails,
        totalRecordsBefore: totalRecordsBefore,
        recordsAfter: recordsAfter,
        duration: duration,
        timestamp: new Date().toISOString(),
      };

      // Log to audit
      await logAudit({
        userId: null,
        action: "cleanup_completed",
        entity: "Tracking",
        entityId: "system",
        metadata: result,
      }).catch(() => {});

      console.log(
        `[CleanupService] Deleted ${deletedCount} records, Kept ${keptCount} records`,
      );
      console.log(`[CleanupService] Duration: ${duration}ms`);

      // Alert if unusually high deletion
      if (deletedCount > 10000) {
        console.log(
          `[CleanupService] WARNING: High volume cleanup! Deleted ${deletedCount} records`,
        );
        await logAudit({
          userId: null,
          action: "high_volume_cleanup",
          entity: "Tracking",
          entityId: "system",
          metadata: {
            deletedCount: deletedCount,
            alert: "Unusually high number of records deleted",
            timestamp: new Date().toISOString(),
          },
        }).catch(() => {});
      }

      return result;
    } catch (error) {
      console.error("[CleanupService] Error during cleanup:", error);

      // Log failure to audit
      await logAudit({
        userId: null,
        action: "cleanup_failed",
        entity: "Tracking",
        entityId: "system",
        metadata: {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {});

      throw error;
    }
  }

  /**
   * Alternative: Clean up records older than X days (more conservative)
   */
  async cleanupOldRecords(daysToKeep = 7) {
    const startTime = Date.now();

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // Keep records from the last 30 minutes (active journeys)
      const activeCutoffTime = new Date(Date.now() - 30 * 60 * 1000);

      const totalRecordsBefore = await db.vehicletracking.count();

      const deletedCount = await db.vehicletracking.destroy({
        where: {
          timestamp: {
            [Op.lt]: cutoffDate,
            [Op.not]: {
              [Op.gte]: activeCutoffTime,
            },
          },
        },
      });

      const duration = Date.now() - startTime;

      // Log audit
      await logAudit({
        userId: null,
        action: "cleanup_old_records",
        entity: "Tracking",
        entityId: "system",
        metadata: {
          operation: "cleanupOldRecords",
          daysToKeep: daysToKeep,
          deletedCount: deletedCount,
          cutoffDate: cutoffDate.toISOString(),
          totalRecordsBefore: totalRecordsBefore,
          recordsAfter: totalRecordsBefore - deletedCount,
          duration: duration,
          timestamp: new Date().toISOString(),
        },
      });

      console.log(
        `[CleanupService] Deleted ${deletedCount} records older than ${daysToKeep} days`,
      );

      return {
        success: true,
        deletedCount,
        daysToKeep,
        duration,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[CleanupService] Error deleting old records:", error);

      await logAudit({
        userId: null,
        action: "cleanup_old_records_failed",
        entity: "Tracking",
        entityId: "system",
        metadata: {
          error: error.message,
          timestamp: new Date().toISOString(),
        },
      }).catch(() => {});

      throw error;
    }
  }

  /**
   * Get cleanup statistics
   */
  async getCleanupStats() {
    try {
      const totalRecords = await db.vehicletracking.count();

      const activeCutoffTime = new Date(Date.now() - 30 * 60 * 1000);

      // Count unique active vehicles
      const activeVehicleesResult = await db.vehicletracking.findAll({
        attributes: [
          [
            db.Sequelize.fn("DISTINCT", db.Sequelize.col("vehicleId")),
            "vehicleId",
          ],
        ],
        where: {
          timestamp: { [Op.gte]: activeCutoffTime },
        },
        raw: true,
      });

      const activeJourneysCount = activeVehicleesResult.length;

      // Get records per vehicle stats
      const recordsPerVehicle = await db.vehicletracking.findAll({
        attributes: [
          "vehicleId",
          [db.Sequelize.fn("COUNT", db.Sequelize.col("id")), "recordCount"],
        ],
        group: ["vehicleId"],
        order: [[db.Sequelize.literal("recordCount"), "DESC"]],
        limit: 10,
        raw: true,
      });

      const oldestRecord = await db.vehicletracking.findOne({
        order: [["timestamp", "ASC"]],
        attributes: ["timestamp"],
        raw: true,
      });

      const newestRecord = await db.vehicletracking.findOne({
        order: [["timestamp", "DESC"]],
        attributes: ["timestamp"],
        raw: true,
      });

      // Records older than 7 days
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recordsOlderThan7Days = await db.vehicletracking.count({
        where: {
          timestamp: { [Op.lt]: sevenDaysAgo },
        },
      });

      return {
        totalTrackingRecords: totalRecords,
        activeJourneysCount: activeJourneysCount,
        oldestRecordTimestamp: oldestRecord?.timestamp,
        newestRecordTimestamp: newestRecord?.timestamp,
        recordsOlderThan7Days: recordsOlderThan7Days,
        estimatedDeletableRecords: recordsOlderThan7Days,
        recordsPerVehicleTop10: recordsPerVehicle,
      };
    } catch (error) {
      console.error("[CleanupService] Error getting stats:", error);
      throw error;
    }
  }

  /**
   * Dry run - show what would be deleted without actually deleting
   */
  async dryRunCleanup() {
    try {
      console.log("[CleanupService] Running dry run cleanup...");

      const activeCutoffTime = new Date(Date.now() - 30 * 60 * 1000);

      const activeVehiclees = await db.vehicletracking.findAll({
        attributes: ["vehicleId"],
        where: {
          timestamp: { [Op.gte]: activeCutoffTime },
        },
        group: ["vehicleId"],
        raw: true,
      });

      const activeVehicleIds = activeVehiclees.map((b) => b.vehicleId);

      let recordsToDelete = 0;
      let recordsToKeep = 0;

      if (activeVehicleIds.length > 0) {
        // Count records to delete from active vehicles (all but latest)
        for (const vehicleId of activeVehicleIds) {
          const recordCount = await db.vehicletracking.count({
            where: { vehicleId },
          });

          if (recordCount > 1) {
            recordsToDelete += recordCount - 1;
            recordsToKeep += 1;
          } else if (recordCount === 1) {
            recordsToKeep += 1;
          }
        }

        // Count records from inactive vehicles
        const inactiveRecords = await db.vehicletracking.count({
          where: {
            vehicleId: { [Op.notIn]: activeVehicleIds },
          },
        });
        recordsToDelete += inactiveRecords;
      } else {
        // No active vehicles - delete all
        recordsToDelete = await db.vehicletracking.count();
        recordsToKeep = 0;
      }

      return {
        success: true,
        isDryRun: true,
        activeVehicleCount: activeVehicleIds.length,
        recordsToDelete: recordsToDelete,
        recordsToKeep: recordsToKeep,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("[CleanupService] Dry run failed:", error);
      throw error;
    }
  }
}

module.exports = new TrackingCleanupService();

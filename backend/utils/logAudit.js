const db = require("../models/index");
const AuditLog = db.auditlogs;
const getChanges = require("./getAuditChanges");

const logAudit = async ({ userId, action, entity, entityId, metadata }) => {
  try {
    // For update actions: compare old and new data
    if (action === "update" && metadata?.before && metadata?.after) {
      metadata.changes = getChanges(metadata.before, metadata.after);
    }

    await AuditLog.create({
      userId,
      action,
      entity,
      entityId,
      metadata: metadata || {},
    });
  } catch (error) {
    console.error("Audit Logging Error", error);
  }
};

module.exports = logAudit;

const logAudit = require("../utils/logAudit");
const http = require("node:http");
const requestIp = require("request-ip");

const auditMiddleware = async (req, res, next) => {
  const originalSend = res.send;

  // Skip multipart requests entirely at the beginning
  const contentType = req.headers["content-type"] || "";
  const isMultipart = contentType.includes("multipart/form-data");

  if (isMultipart) {
    return next(); // Skip audit for multipart requests
  }

  res.send = function (data) {
    res.responseData = data;
    originalSend.apply(res, arguments);
  };

  res.on("finish", async () => {
    try {
      // Skip logging for GET requests (read operations)
      if (req.method === "GET") {
        return;
      }

      const userId = req.user?.id || null;
      const action = getActionFromMethod(req.method);
      const entity = getEntityFromPath(req.path);

      // Safely extract entityId from params or body
      let entityId = req.params?.entityId || req.params?.id || "multiple";

      // Try to get entityId from request body for POST/PUT operations
      if (!entityId || entityId === "multiple") {
        if (req.body?.id) {
          entityId = req.body.id;
        } else if (req.body?.applicationId) {
          entityId = req.body.applicationId;
        } else if (req.params?.applicationId) {
          entityId = req.params.applicationId;
        }
      }

      if (shouldLogRequest(req)) {
        await logAudit({
          userId,
          action,
          entity,
          entityId: entityId || "multiple",
          metadata: {
            method: req.method,
            path: req.path,
            query: req.query,
            statusCode: res.statusCode,
            userAgent: req.get("User-Agent"),
            ip: requestIp.getClientIp(req),
            timestamp: new Date().toISOString(),
          },
        });
      }
    } catch (error) {
      console.error("Audit middleware error:", error);
      // Don't throw error to avoid breaking the response
    }
  });

  next();
};

function getActionFromMethod(method) {
  const actions = {
    GET: "read",
    POST: "create",
    PUT: "update",
    PATCH: "update",
    DELETE: "delete",
  };
  return actions[method] || "other";
}

function getEntityFromPath(path) {
  const entities = {
    "/auth/login": "Login",
    "/auth/logout": "Logout",
    "/grades": "Grade",
    "/classnames": "Classname",
    "/teacher-subject": "Teacher-Subject Assignment",
    "/teacher-class": "Teacher-Class Assignment",
    "/users": "User",
    "/auth": "Auth",
    "/buses": "Bus Management",
    "/busroutes": "Bus Routes",
    "/driverassignment": "Grade",
    "/classes": "Class",
    "/driverassignemt": "Bus-Driver Assignment",
    "/bus-tracking": "Bus Tracking",
  };

  for (const [key, value] of Object.entries(entities)) {
    if (path.includes(key)) return value;
  }

  return "Unknown";
}

function shouldLogRequest(req) {
  const excludedPaths = [
    "/health",
    "/static",
    "/favicon.ico",
    "/notifications",
    "/auth/refresh-token",
    "/auditlogs",
  ];

  // Also exclude GET requests
  if (req.method === "GET") {
    return false;
  }

  return !excludedPaths.some((path) => req.path.includes(path));
}

module.exports = auditMiddleware;

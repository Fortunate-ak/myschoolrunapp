const announcementMessages = {
  new_announcement: (announcement) => ({
    title: "New Announcement",
    message: `${announcement.author.name} posted a new announcement`,
    notifType: "info",
  }),

  announcement_updated: (announcement) => ({
    title: "Announcement Updated",
    message: `${announcement.author.name} updated an announcement`,
    notifType: "warning",
  }),

  important_announcement: (announcement) => ({
    title: "Important Announcement",
    message: `${announcement.author.name} posted an important announcement`,
    notifType: "alert",
  }),

  class_specific_announcement: (announcement, className) => ({
    title: "Class Announcement",
    message: `${announcement.author.name} posted an announcement for ${className}`,
    notifType: "info",
  }),

  grade_specific_announcement: (announcement, gradeName) => ({
    title: "Grade Announcement",
    message: `${announcement.author.name} posted an announcement for ${gradeName}`,
    notifType: "info",
  }),
};

const vehicleAlertMessages = {
  delay: (alert, vehicle) => ({
    title: "Vehicle Delay Alert",
    message: `Vehicle ${vehicle.vehicleNumber} is delayed by ${alert.delayMinutes} minutes`,
    notifType: "warning",
  }),
  arrival: (alert, vehicle, stop) => ({
    title: "Vehicle Arriving",
    message: `Vehicle ${vehicle.vehicleNumber} is arriving at ${stop.stopName}`,
    notifType: "info",
  }),
  emergency: (alert, vehicle) => ({
    title: "Emergency Alert",
    message: `Emergency alert for vehicle ${vehicle.vehicleNumber}: ${alert.message}`,
    notifType: "error",
  }),
  breakdown: (alert, vehicle) => ({
    title: "Vehicle Breakdown",
    message: `Vehicle ${vehicle.vehicleNumber} has broken down. ${alert.message}`,
    notifType: "error",
  }),
  route_deviation: (alert, vehicle) => ({
    title: "Route Deviation",
    message: `Vehicle ${vehicle.vehicleNumber} has deviated from its route`,
    notifType: "warning",
  }),
  speeding: (alert, vehicle) => ({
    title: "Speeding Alert",
    message: `Vehicle ${vehicle.vehicleNumber} is traveling at high speed`,
    notifType: "warning",
  }),
  maintenance_due: (alert, vehicle) => ({
    title: "Maintenance Due",
    message: `Vehicle ${vehicle.vehicleNumber} requires maintenance`,
    notifType: "warning",
  }),
  student_absent: (alert, vehicle, student) => ({
    title: "Student Absent",
    message: `${student?.firstName || "Student"} missed the vehicle`,
    notifType: "warning",
  }),
};

const assignmentMessages = {
  new_assignment: (assignment, teacher) => ({
    title: "New Assignment Posted",
    message: `${teacher?.fullname || "Teacher"} posted a new ${assignment.type || "assignment"}: ${assignment.title}`,
    notifType: "info",
  }),

  assignment_updated: (assignment, teacher, changes) => ({
    title: "Assignment Updated",
    message: `${teacher?.fullname || "Teacher"} updated the assignment: ${assignment.title}`,
    notifType: "warning",
  }),

  assignment_submitted: (assignment, student) => ({
    title: "Assignment Submitted",
    message: `${student?.user?.fullname || "Student"} submitted: ${assignment.title}`,
    notifType: "info",
  }),

  assignment_graded: (assignment, submission, teacher) => ({
    title: "Assignment Graded",
    message: `Your ${assignment.type || "assignment"} "${assignment.title}" has been graded: ${submission.percentage?.toFixed(1) || "?"}%`,
    notifType: submission.percentage >= 70 ? "success" : "warning",
  }),

  deadline_reminder: (assignment, daysUntilDue) => ({
    title:
      daysUntilDue <= 1 ? "Assignment Due Tomorrow!" : "Assignment Due Soon",
    message: `"${assignment.title}" is due in ${daysUntilDue} ${daysUntilDue === 1 ? "day" : "days"}`,
    notifType: daysUntilDue <= 1 ? "alert" : "warning",
  }),

  extension_granted: (assignment, extensionDays, newDueDate) => ({
    title: "Assignment Extension Granted",
    message: `Extension of ${extensionDays} days granted for "${assignment.title}". New due date: ${newDueDate.toLocaleDateString()}`,
    notifType: "info",
  }),

  teacher_feedback: (assignment, teacher) => ({
    title: "New Feedback on Assignment",
    message: `${teacher?.fullname || "Teacher"} provided feedback on "${assignment.title}"`,
    notifType: "info",
  }),

  late_submission: (assignment, student) => ({
    title: "Late Submission",
    message: `${student?.user?.fullname || "Student"}  submitted "${assignment.title}" late`,
    notifType: "warning",
  }),

  assignment_reminder: (assignment) => ({
    title: "Assignment Reminder",
    message: `Don't forget to complete: ${assignment.title}`,
    notifType: "info",
  }),
};

const messageNotificationMessages = {
  new_message: (
    sender,
    messagePreview,
    conversationName,
    conversationType,
  ) => ({
    title:
      conversationType === "private"
        ? `New message from ${sender.fullname}`
        : `New message in ${conversationName}`,
    message:
      conversationType === "private"
        ? `${sender.fullname}: ${messagePreview || "Sent a message"}`
        : `${sender.fullname} in ${conversationName}: ${messagePreview || "Sent a message"}`,
    notifType: "info",
  }),

  message_reply: (replySender, originalSender, replyPreview) => ({
    title: `${replySender.fullname} replied to your message`,
    message: `${replySender.fullname}: ${replyPreview || "Replied to your message"}`,
    notifType: "info",
  }),

  added_to_group: (addedBy, groupName) => ({
    title: `Added to ${groupName}`,
    message: `${addedBy.fullname} added you to ${groupName}`,
    notifType: "info",
  }),

  mentioned_in_message: (mentionedBy, messagePreview, conversationName) => ({
    title: `${mentionedBy.fullname} mentioned you`,
    message: `${mentionedBy.fullname} mentioned you in ${conversationName}: ${messagePreview}`,
    notifType: "mention",
  }),

  message_edited: (editor, originalSender) => ({
    title: "Message was edited",
    message: `${editor.fullname} edited a message you sent`,
    notifType: "warning",
  }),

  unread_messages_summary: (totalUnread, topConversations) => ({
    title: `You have ${totalUnread} unread message${totalUnread > 1 ? "s" : ""}`,
    message: topConversations
      .map((c) => `${c.name} (${c.unreadCount})`)
      .join(", "),
    notifType: "info",
  }),

  urgent_message: (sender, messagePreview) => ({
    title: `🚨 Urgent message from ${sender.fullname}`,
    message: messagePreview || "Urgent message received",
    notifType: "alert",
  }),

  file_shared: (sender, fileCount, fileType, conversationName) => ({
    title: `${sender.fullname} shared ${fileCount} ${fileType}${fileCount > 1 ? "s" : ""}`,
    message: `New ${fileType}${fileCount > 1 ? "s" : ""} in ${conversationName}`,
    notifType: "info",
  }),

  message_reaction: (reactor, reaction) => ({
    title: `${reactor.fullname} reacted to your message`,
    message: `Reacted with ${reaction}`,
    notifType: "info",
  }),

  message_digest: (
    totalMessages,
    uniqueSenders,
    conversationCount,
    period,
  ) => ({
    title: `Your ${period} message digest`,
    message: `${totalMessages} messages from ${uniqueSenders} people in ${conversationCount} conversations`,
    notifType: "info",
  }),

  broadcast_message: (sender, messagePreview) => ({
    title: `📢 Broadcast from ${sender.fullname}`,
    message: messagePreview || "New broadcast message",
    notifType: "info",
  }),
};

const procurementMessages = {
  // Fired when a department user submits a new request
  request_submitted: (request, departmentRoleName) => ({
    title: "New department request",
    message: `${departmentRoleName} department submitted request ${request.requestNumber}`,
    notifType: "info",
  }),

  // Fired to the submitter when procurement rejects at initial review
  request_rejected_by_procurement: (request, notes) => ({
    title: "Request rejected",
    message: `Your request ${request.requestNumber} was rejected by procurement${notes ? `: ${notes}` : ""}`,
    notifType: "error",
  }),

  // Fired to finance/bursar when procurement forwards the request
  forwarded_to_finance: (request, officerName) => ({
    title: "Budget approval required",
    message: `${officerName} forwarded request ${request.requestNumber} for budget approval`,
    notifType: "info",
  }),

  // Fired to procurement and the submitter when finance approves
  finance_approved: (request) => ({
    title: "Budget approved",
    message: `Finance approved the budget for request ${request.requestNumber}`,
    notifType: "success",
  }),

  // Fired to procurement and the submitter when finance rejects
  finance_rejected: (request, reason) => ({
    title: "Budget rejected",
    message: `Finance rejected the budget for request ${request.requestNumber}${reason ? `: ${reason}` : ""}`,
    notifType: "error",
  }),

  // Fired to the submitter when procurement starts processing
  procurement_processing: (request) => ({
    title: "Request is being processed",
    message: `Procurement is now sourcing items for request ${request.requestNumber}`,
    notifType: "info",
  }),

  // Fired to the submitter when delivery is recorded
  delivery_ready: (request) => ({
    title: "Delivery ready for confirmation",
    message: `Items for request ${request.requestNumber} have been delivered — please confirm receipt`,
    notifType: "info",
  }),

  // Fired to procurement when the department raises a dispute
  dispute_raised: (request, departmentRoleName, reason) => ({
    title: "Delivery dispute raised",
    message: `${departmentRoleName} raised a dispute on delivery for ${request.requestNumber}${reason ? `: ${reason}` : ""}`,
    notifType: "warning",
  }),

  // Fired to the submitter when dispute is resolved and re-delivered
  dispute_resolved: (request) => ({
    title: "Dispute resolved",
    message: `Procurement has resolved the dispute for request ${request.requestNumber} — please re-confirm receipt`,
    notifType: "info",
  }),

  // Fired to both parties when request is fully completed
  request_completed: (request) => ({
    title: "Request completed",
    message: `Request ${request.requestNumber} has been successfully completed and closed`,
    notifType: "success",
  }),

  // Fired to the submitter when request is cancelled
  request_cancelled: (request, reason) => ({
    title: "Request cancelled",
    message: `Request ${request.requestNumber} has been cancelled${reason ? `: ${reason}` : ""}`,
    notifType: "warning",
  }),
};

const guardianRequestMessages = {
  request_sent: (request, guardianName) => ({
    title: "New Request",
    message:
      request.requestType === "student_onboard_request"
        ? `${guardianName} requested to onboard ${request.numberOfStudents} student${request.numberOfStudents > 1 ? "s" : ""}`
        : `${guardianName} requested a route assignment for their child`,
    notifType: "info",
  }),

  request_approved: (request, driverName) => ({
    title: "Request Approved",
    message: `${driverName} approved your request`,
    notifType: "success",
  }),

  request_rejected: (request, driverName) => ({
    title: "Request Declined",
    message: `${driverName} declined your request`,
    notifType: "error",
  }),

  request_cancelled: (request, guardianName) => ({
    title: "Request Cancelled",
    message: `${guardianName} cancelled their request`,
    notifType: "warning",
  }),
};

module.exports = {
  assignmentMessages,
  announcementMessages,
  vehicleAlertMessages,
  messageNotificationMessages,
  procurementMessages,
  guardianRequestMessages,
};

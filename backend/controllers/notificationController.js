const {
  getUserNotifications,
  markAsRead,
  markAllAsRead,
} = require("../services/notificationService");

const getNotificationsByUser = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await getUserNotifications(userId);

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

const markNotificationAsRead = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const notification = await markAsRead(id, userId);

    return res.status(200).json(notification);
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

const markAllNotificationsAsRead = async (req, res) => {
  try {
    const userId = req.user.id;

    await markAllAsRead(userId);

    return res
      .status(200)
      .json({ message: "All notifications marked as read" });
  } catch (error) {
    return res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  markAllNotificationsAsRead,
  markNotificationAsRead,
  getNotificationsByUser,
};

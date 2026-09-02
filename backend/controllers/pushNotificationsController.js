const db = require("../models/index");
const PushNotificationToken = db.pushnotificationtokens;

const registerPushNotificationToken = async (req, res) => {
  const transaction = await db.sequelize.transaction();
  const user = req.user;

  try {
    const { expoPushToken, deviceName, deviceType, platform, appVersion } =
      req.body;

    if (!expoPushToken) {
      await transaction.rollback();
      return res.status(400).json({ message: "expoPushToken required" });
    }

    const existingToken = await PushNotificationToken.findOne({
      where: { expoPushToken },
      transaction,
    });

    if (existingToken) {
      if (existingToken.userId !== user.id) {
        await existingToken.update(
          {
            userId: user.id,
            deviceName: deviceName || existingToken.deviceName,
            deviceType: deviceType || existingToken.deviceType,
            platform: platform || existingToken.platform,
            appVersion: appVersion || existingToken.appVersion,
            lastUsed: new Date(),
            isActive: true,
          },
          { transaction },
        );

        await transaction.commit();
        return res.status(200).json({
          message: "Push token reassigned to current user",
          token: existingToken,
        });
      } else {
        await existingToken.update(
          {
            deviceName: deviceName || existingToken.deviceName,
            deviceType: deviceType || existingToken.deviceType,
            platform: platform || existingToken.platform,
            appVersion: appVersion || existingToken.appVersion,
            lastUsed: new Date(),
            isActive: true,
          },
          { transaction },
        );

        await transaction.commit();
        return res.status(200).json({
          message: "Push token updated successfully",
          token: existingToken,
        });
      }
    }

    const newToken = await PushNotificationToken.create(
      {
        userId: user.id,
        expoPushToken,
        deviceName: deviceName || null,
        deviceType: deviceType || null,
        platform: platform || null,
        appVersion: appVersion || null,
        lastUsed: new Date(),
        isActive: true,
      },
      { transaction },
    );

    await transaction.commit();
    return res.status(201).json({
      message: "Push token registered successfully",
      token: newToken,
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    console.error("Failed to register push token:", error);
    return res.status(500).json({
      message: "Failed to register push token",
    });
  }
};

const unregisterPushNotificationToken = async (req, res) => {
  const transaction = await db.sequelize.transaction();

  try {
    const { expoPushToken } = req.body;

    if (!expoPushToken) {
      return res.status(400).json({
        message: "expoPushToken is required",
      });
    }

    const token = await PushNotificationToken.findOne({
      where: {
        expoPushToken,
        userId: req.user.id,
      },
      transaction,
    });

    if (!token) {
      return res.status(404).json({
        message: "Push token not found or already unregistered",
      });
    }

    await token.update(
      {
        isActive: false,
      },
      { transaction },
    );

    await transaction.commit();

    return res.status(200).json({
      message: "Push token unregistered successfully",
    });
  } catch (error) {
    if (transaction && !transaction.finished) {
      await transaction.rollback();
    }
    res.status(500).json({
      message: "Failed to unregister push token",
    });
  }
};

const getAllPushTokens = async (req, res) => {
  const { id } = req.user;
  try {
    const tokens = await PushNotificationToken.findAll({
      where: { userId: id, isActive: true },
    });

    return res.status(200).json(tokens);
  } catch (error) {
    return res.status(500).json({
      message: "Failed to fetch push tokens",
    });
  }
};

module.exports = {
  getAllPushTokens,
  unregisterPushNotificationToken,
  registerPushNotificationToken,
};

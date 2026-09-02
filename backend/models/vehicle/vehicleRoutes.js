module.exports = (sequelize, DataTypes) => {
  const VehicleRoute = sequelize.define(
    "vehicleroutes",
    {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
      },

      routeNumber: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      routeName: {
        type: DataTypes.STRING,
        allowNull: false,
      },

      vehicleId: {
        type: DataTypes.UUID,
        allowNull: false,
      },

      routeType: {
        type: DataTypes.ENUM("pickup", "dropoff", "both"),
        defaultValue: "both",
        allowNull: false,
      },

      startTime: {
        type: DataTypes.TIME,
        allowNull: false,
      },

      estimatedEndTime: {
        type: DataTypes.TIME,
        allowNull: false,
      },

      activeDays: {
        type: DataTypes.JSON,
        allowNull: false,
        defaultValue: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
        get() {
          const raw = this.getDataValue("activeDays");
          if (Array.isArray(raw)) return raw;
          if (typeof raw === "string") {
            try {
              const parsed = JSON.parse(raw);
              return Array.isArray(parsed)
                ? parsed
                : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
            } catch {
              return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
            }
          }
          return ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        },
        validate: {
          isValidDays(value) {
            const valid = [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ];
            if (!Array.isArray(value) || value.length === 0) {
              throw new Error("activeDays must be a non-empty array");
            }
            for (const day of value) {
              if (!valid.includes(day)) {
                throw new Error(`Invalid day: ${day}`);
              }
            }
          },
        },
      },

      totalDistance: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
        comment:
          "Total route distance in kilometres, calculated from GPS coordinates",
        validate: {
          min: 0,
        },
      },

      estimatedDuration: {
        type: DataTypes.INTEGER,
        allowNull: true,
        comment: "Estimated route duration in minutes",
        validate: {
          min: 0,
        },
      },

      status: {
        type: DataTypes.ENUM("active", "suspended", "inactive"),
        defaultValue: "active",
        allowNull: false,
      },

      isActive: {
        type: DataTypes.BOOLEAN,
        defaultValue: true,
      },

      stops: {
        type: DataTypes.JSON,
        allowNull: true,
        defaultValue: [],
        get() {
          const raw = this.getDataValue("stops");

          // Already a parsed array — ideal case
          if (Array.isArray(raw)) {
            return raw.map((stop) => normalizeStop(stop));
          }

          if (typeof raw === "string") {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                return parsed.map((stop) => normalizeStop(stop));
              }
            } catch {
              // fall through to empty array
            }
          }

          return [];
        },
        set(value) {
          if (!Array.isArray(value)) {
            this.setDataValue("stops", []);
            return;
          }

          const validated = value.map((stop, index) => {
            const lat =
              stop.location?.latitude != null
                ? parseFloat(stop.location.latitude)
                : null;
            const lon =
              stop.location?.longitude != null
                ? parseFloat(stop.location.longitude)
                : null;

            if (lat != null && (lat < -90 || lat > 90)) {
              throw new Error(
                `Stop "${stop.stopName}" has invalid latitude: ${lat}`,
              );
            }
            if (lon != null && (lon < -180 || lon > 180)) {
              throw new Error(
                `Stop "${stop.stopName}" has invalid longitude: ${lon}`,
              );
            }

            return {
              id:
                stop.id && !stop.id.startsWith("temp_")
                  ? stop.id
                  : `stop_${Date.now()}_${index}`,
              stopType: stop.stopType === "home" ? "home" : "school",
              stopName: stop.stopName || `Stop ${index + 1}`,
              stopOrder: stop.stopOrder || index + 1,
              location: {
                latitude: lat,
                longitude: lon,
                address: stop.location?.address || null,
              },
              scheduledPickupTime: stop.scheduledPickupTime || null,
              scheduledDropoffTime: stop.scheduledDropoffTime || null,
              estimatedWaitTime:
                typeof stop.estimatedWaitTime === "number"
                  ? stop.estimatedWaitTime
                  : 2,

              isActive: stop.isActive !== undefined ? stop.isActive : true,
              createdAt: stop.createdAt || new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            };
          });

          this.setDataValue("stops", validated);
        },
        validate: {
          hasValidCoordinates(value) {
            if (!Array.isArray(value)) return;
            for (const stop of value) {
              if (
                stop.location?.latitude != null &&
                stop.location?.longitude != null
              ) {
                const lat = parseFloat(stop.location.latitude);
                const lon = parseFloat(stop.location.longitude);
                if (lat < -90 || lat > 90 || lon < -180 || lon > 180) {
                  throw new Error(
                    `Stop "${stop.stopName}" has invalid coordinates`,
                  );
                }
              }
            }
          },
          hasSequentialOrders(value) {
            if (!Array.isArray(value) || value.length === 0) return;
            const orders = value.map((s) => s.stopOrder);
            const unique = new Set(orders);
            if (unique.size !== orders.length) {
              throw new Error("Duplicate stop orders are not allowed");
            }
          },
        },
      },
    },
    {
      freezeTableName: true,
      timestamps: true,
      hooks: {
        beforeValidate(route) {
          if (Array.isArray(route.stops) && route.stops.length > 0) {
            route.stops.sort((a, b) => a.stopOrder - b.stopOrder);
          }
        },
        afterCreate: async (route, options) => {
          await route.syncStopsToVehicleStopsTable(options.transaction);
        },
        afterUpdate: async (route, options) => {
          await route.syncStopsToVehicleStopsTable(options.transaction);
        },
      },
    },
  );

  // ── Helper: normalise a single stop's location field ────────────────────
  // Used in the getter to ensure location is always a plain object,
  // never a JSON string (which can happen if the column was double-encoded).
  function normalizeStop(stop) {
    if (!stop) return stop;
    let loc = stop.location;
    if (typeof loc === "string") {
      try {
        loc = JSON.parse(loc);
      } catch {
        loc = { latitude: null, longitude: null, address: null };
      }
    }
    return {
      ...stop,
      stopType: stop.stopType === "home" ? "home" : "school",
      location: {
        latitude: loc?.latitude != null ? Number(loc.latitude) : null,
        longitude: loc?.longitude != null ? Number(loc.longitude) : null,
        address: loc?.address || null,
      },
    };
  }

  // ── Associations ────────────────────────────────────────────────────────

  VehicleRoute.associate = (models) => {
    VehicleRoute.belongsTo(models.vehicles, {
      foreignKey: "vehicleId",
      as: "vehicle",
    });

    VehicleRoute.hasMany(models.vehicleassignments, {
      foreignKey: "routeId",
      as: "studentAssignments",
    });
  };

  // ── Instance methods ────────────────────────────────────────────────────

  /** Sync stops JSON to vehiclestops table */
  VehicleRoute.prototype.syncStopsToVehicleStopsTable = async function (
    transaction,
  ) {
    const VehicleStop = sequelize.models.vehiclestops;

    const currentStops = this.stops || [];

    const existingStops = await VehicleStop.findAll({
      where: { routeId: this.id },
      transaction,
    });

    const existingStopMap = new Map(existingStops.map((s) => [s.id, s]));
    const keepStopIds = new Set();

    for (const stopData of currentStops) {
      const stopId = stopData.id;
      keepStopIds.add(stopId);

      const location = {
        latitude: stopData.location?.latitude,
        longitude: stopData.location?.longitude,
        address: stopData.location?.address || null,
      };

      if (existingStopMap.has(stopId)) {
        const existingStop = existingStopMap.get(stopId);
        await existingStop.update(
          {
            stopName: stopData.stopName,
            stopOrder: stopData.stopOrder,
            location: location,
            scheduledPickupTime: stopData.scheduledPickupTime,
            scheduledDropoffTime: stopData.scheduledDropoffTime,
            estimatedWaitTime: stopData.estimatedWaitTime,
            landmark: stopData.landmark,
            notes: stopData.notes,
            isActive: stopData.isActive !== false,
          },
          { transaction },
        );
      } else {
        await VehicleStop.create(
          {
            id: stopId,
            routeId: this.id,
            stopName: stopData.stopName,
            stopOrder: stopData.stopOrder,
            location: location,
            scheduledPickupTime: stopData.scheduledPickupTime,
            scheduledDropoffTime: stopData.scheduledDropoffTime,
            estimatedWaitTime: stopData.estimatedWaitTime,
            landmark: stopData.landmark,
            notes: stopData.notes,
            isActive: stopData.isActive !== false,
          },
          { transaction },
        );
      }
    }

    for (const existingStop of existingStops) {
      if (!keepStopIds.has(existingStop.id)) {
        const studentCount = await sequelize.models.students.count({
          where: { vehicleStopId: existingStop.id },
          transaction,
        });

        if (studentCount === 0) {
          await existingStop.destroy({ transaction });
        } else {
          await existingStop.update({ isActive: false }, { transaction });
        }
      }
    }
  };

  /** Get a stop by its order number */
  VehicleRoute.prototype.getStopByOrder = function (order) {
    return (this.stops || []).find((s) => s.stopOrder === order) || null;
  };

  /** Get a stop by its ID */
  VehicleRoute.prototype.getStopById = function (stopId) {
    return (this.stops || []).find((s) => s.id === stopId) || null;
  };

  /** Add a stop. Mutates instance, does NOT save. */
  VehicleRoute.prototype.addStop = function (stopData) {
    const stops = [...(this.stops || [])];
    const newStop = {
      id: `stop_${Date.now()}_${stops.length}`,
      stopType: stopData.stopType === "home" ? "home" : "school",
      stopOrder: stops.length + 1,
      estimatedWaitTime: 2,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...stopData,
      location: {
        latitude:
          stopData.location?.latitude != null
            ? parseFloat(stopData.location.latitude)
            : null,
        longitude:
          stopData.location?.longitude != null
            ? parseFloat(stopData.location.longitude)
            : null,
        address: stopData.location?.address || null,
      },
    };
    stops.push(newStop);
    this.stops = stops;
    return newStop;
  };

  /** Update a stop by ID. Mutates instance, does NOT save. */
  VehicleRoute.prototype.updateStop = function (stopId, updateData) {
    const stops = [...(this.stops || [])];
    const idx = stops.findIndex((s) => s.id === stopId);
    if (idx === -1) return null;

    stops[idx] = {
      ...stops[idx],
      ...updateData,
      location: {
        ...stops[idx].location,
        ...(updateData.location || {}),
      },
      updatedAt: new Date().toISOString(),
    };
    this.stops = stops;
    return stops[idx];
  };

  /** Remove a stop and reorder remaining. Mutates instance, does NOT save. */
  VehicleRoute.prototype.removeStop = function (stopId) {
    const filtered = (this.stops || [])
      .filter((s) => s.id !== stopId)
      .map((s, i) => ({ ...s, stopOrder: i + 1 }));
    this.stops = filtered;
    return filtered;
  };

  /** Reorder stops by array of IDs. Mutates instance, does NOT save. */
  VehicleRoute.prototype.reorderStops = function (newOrderIds) {
    const stopMap = new Map((this.stops || []).map((s) => [s.id, s]));
    const reordered = newOrderIds.map((id, i) => ({
      ...stopMap.get(id),
      stopOrder: i + 1,
      updatedAt: new Date().toISOString(),
    }));
    this.stops = reordered;
    return reordered;
  };

  // ── Helper: distance in metres between two coordinates ──────────────────
  function haversineMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  /**
   * Find an existing stop of the given type within `thresholdMeters` of a
   * coordinate. Used to avoid creating a duplicate stop when two students
   * live near each other, or attend the same school.
   */
  VehicleRoute.prototype.findNearbyStop = function (
    lat,
    lon,
    stopType,
    thresholdMeters = 150,
  ) {
    if (lat == null || lon == null) return null;
    return (
      (this.stops || []).find(
        (s) =>
          s.stopType === stopType &&
          s.location?.latitude != null &&
          s.location?.longitude != null &&
          haversineMeters(
            lat,
            lon,
            s.location.latitude,
            s.location.longitude,
          ) <= thresholdMeters,
      ) || null
    );
  };

  /**
   * Reuse a nearby stop of the same type if one exists, otherwise create a
   * new one and insert it into `this.stops` (home stops are kept ahead of
   * school stops so stopOrder reads as a single AM pickup sequence — the
   * PM/dropoff leg is just this same order reversed).
   *
   * Mutates `this.stops` via the model setter — caller must still
   * `route.save()` for it to persist (and to trigger the afterUpdate hook
   * that syncs the vehiclestops table).
   */
  VehicleRoute.prototype.findOrCreateStop = function (
    locationData,
    stopType,
    stopName,
  ) {
    const lat =
      locationData?.latitude != null ? parseFloat(locationData.latitude) : null;
    const lon =
      locationData?.longitude != null
        ? parseFloat(locationData.longitude)
        : null;

    const existing = this.findNearbyStop(lat, lon, stopType);
    if (existing) return existing;

    const stops = [...(this.stops || [])];
    const newStop = {
      id: `stop_${Date.now()}_${stops.length}`,
      stopType,
      stopName:
        stopName || (stopType === "school" ? "School Stop" : "Home Stop"),
      estimatedWaitTime: 2,
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      location: {
        latitude: lat,
        longitude: lon,
        address: locationData?.address || null,
      },
    };

    if (stopType === "home") {
      // Keep every home stop ahead of every school stop in stopOrder, so
      // the list reads as a single AM sequence (home pickups → schools).
      const firstSchoolIdx = stops.findIndex((s) => s.stopType === "school");
      stops.splice(
        firstSchoolIdx === -1 ? stops.length : firstSchoolIdx,
        0,
        newStop,
      );
    } else {
      stops.push(newStop);
    }

    // Re-run through the model setter (renumbers stopOrder, validates coords).
    this.stops = stops.map((s, i) => ({ ...s, stopOrder: i + 1 }));
    return this.stops.find(
      (s) =>
        s.stopType === stopType &&
        s.location?.latitude === lat &&
        s.location?.longitude === lon,
    );
  };

  // ── Static helpers ──────────────────────────────────────────────────────

  /** Fetch a route with vehicle + driver details. stops come from JSON column. */
  VehicleRoute.findWithFullDetails = async function (routeId) {
    return this.findByPk(routeId, {
      include: [
        {
          model: sequelize.models.vehicles,
          as: "vehicle",
          include: [
            {
              model: sequelize.models.drivers,
              as: "driver",
              include: [
                {
                  model: sequelize.models.users,
                  as: "user",
                  attributes: ["id", "fullname", "phone"],
                },
              ],
            },
          ],
        },
        // vehicleStops intentionally excluded — use route.stops (JSON column) instead
      ],
    });
  };

  return VehicleRoute;
};

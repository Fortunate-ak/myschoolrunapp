/**
 * screens/EmergencyRideHistoryScreen.js
 *
 * Emergency Ride History
 * - Shows list of past emergency rides
 * - Displays ride status, driver, date, price
 * - Filter by status or date
 * - Tap to view ride details
 */

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Image,
  ActivityIndicator,
  TextInput,
  SectionList,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useDispatch, useSelector } from "react-redux";
import Toast from "react-native-toast-message";
import { getInitials } from "../utils/helpers";
import axios from "axios";

// Status Badge Component
const StatusBadge = ({ status, T }) => {
  const statusConfig = {
    COMPLETED: { color: T.success, icon: "checkmark-circle", label: "Completed" },
    CANCELLED: { color: "#ef4444", icon: "close-circle", label: "Cancelled" },
    DRIVER_REJECTED: { color: "#f97316", icon: "close-circle", label: "Rejected" },
    IN_TRANSIT: { color: T.accent, icon: "car", label: "In Transit" },
  };

  const config = statusConfig[status];
  if (!config) return null;

  return (
    <View style={[styles.statusBadge, { backgroundColor: config.color }]}>
      <Ionicons name={config.icon} size={12} color="#fff" />
      <Text style={styles.statusBadgeText}>{config.label}</Text>
    </View>
  );
};

// Format date helper
const formatDate = (dateString) => {
  const date = new Date(dateString);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return `Today at ${date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  } else if (date.toDateString() === yesterday.toDateString()) {
    return `Yesterday at ${date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    })}`;
  }
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
};

export default function EmergencyRideHistoryScreen({ navigation }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();

  const [rides, setRides] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filteredRides, setFilteredRides] = useState([]);

  const { userId } = useSelector((state) => state.users);

  // Fetch emergency ride history
  useEffect(() => {
    const fetchRideHistory = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get("/emergency-rides/history");
        if (response.data && Array.isArray(response.data)) {
          // Sort by date, newest first
          const sorted = response.data.sort(
            (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
          );
          setRides(sorted);
          setFilteredRides(sorted);
        }
      } catch (error) {
        console.error("Error fetching ride history:", error);
        Toast.show({
          type: "error",
          text1: "Error",
          text2: "Could not load ride history",
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchRideHistory();
  }, []);

  // Filter rides based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredRides(rides);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = rides.filter((ride) => {
      const driverName =
        `${ride.driver?.firstName} ${ride.driver?.lastName}`.toLowerCase();
      const pickupAddress = ride.pickupAddress?.toLowerCase() || "";
      const destinationAddress = ride.destinationAddress?.toLowerCase() || "";
      const status = ride.status?.toLowerCase() || "";

      return (
        driverName.includes(query) ||
        pickupAddress.includes(query) ||
        destinationAddress.includes(query) ||
        status.includes(query)
      );
    });

    setFilteredRides(filtered);
  }, [searchQuery, rides]);

  // Group rides by date
  const groupedRides = filteredRides.reduce((groups, ride) => {
    const date = new Date(ride.createdAt).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const existingGroup = groups.find((g) => g.title === date);
    if (existingGroup) {
      existingGroup.data.push(ride);
    } else {
      groups.push({ title: date, data: [ride] });
    }
    return groups;
  }, []);

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: T.bg }]}>
        <View
          style={[
            styles.header,
            {
              backgroundColor: T.surface,
              borderBottomColor: T.border,
              paddingTop: insets.top,
            },
          ]}
        >
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={T.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: T.text }]}>
            Emergency Ride History
          </Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.center}>
          <ActivityIndicator color={T.accent} size="large" />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: T.bg }]}>
      {/* Header */}
      <View
        style={[
          styles.header,
          {
            backgroundColor: T.surface,
            borderBottomColor: T.border,
            paddingTop: insets.top,
          },
        ]}
      >
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={T.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: T.text }]}>
          Emergency Ride History
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Bar */}
      <View
        style={[
          styles.searchBar,
          {
            backgroundColor: T.surface,
            borderColor: T.border,
          },
        ]}
      >
        <Ionicons name="search" size={18} color={T.textMuted} />
        <TextInput
          style={[styles.searchInput, { color: T.text }]}
          placeholder="Search by driver or location..."
          placeholderTextColor={T.textMuted}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery ? (
          <TouchableOpacity onPress={() => setSearchQuery("")}>
            <Ionicons name="close-circle" size={18} color={T.textMuted} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Rides List */}
      {filteredRides.length === 0 ? (
        <View style={styles.center}>
          <View
            style={[
              styles.emptyIcon,
              { backgroundColor: T.accentDim },
            ]}
          >
            <Ionicons name="car-outline" size={48} color={T.accent} />
          </View>
          <Text style={[styles.emptyTitle, { color: T.text }]}>
            No Rides Found
          </Text>
          <Text style={[styles.emptyDesc, { color: T.textMuted }]}>
            {searchQuery
              ? "Try adjusting your search"
              : "You haven't taken any emergency rides yet"}
          </Text>
        </View>
      ) : (
        <SectionList
          sections={groupedRides}
          keyExtractor={(item, index) => item.id + index}
          renderItem={({ item: ride }) => (
            <TouchableOpacity
              onPress={() => {
                navigation.navigate("EmergencyRideDetails", {
                  rideId: ride.id,
                  ride,
                });
              }}
              activeOpacity={0.7}
            >
              <View
                style={[
                  styles.rideCard,
                  {
                    backgroundColor: T.surface,
                    borderColor: T.border,
                  },
                ]}
              >
                {/* Driver Info */}
                <View style={styles.rideCardTop}>
                  {ride.driver?.profileImage ? (
                    <Image
                      source={{ uri: ride.driver.profileImage }}
                      style={styles.driverAvatar}
                    />
                  ) : (
                    <View
                      style={[
                        styles.driverAvatarFallback,
                        { backgroundColor: T.accent },
                      ]}
                    >
                      <Text style={styles.driverInitials}>
                        {getInitials(
                          ride.driver?.firstName + " " + ride.driver?.lastName
                        )}
                      </Text>
                    </View>
                  )}

                  <View style={{ flex: 1 }}>
                    <Text style={[styles.driverName, { color: T.text }]}>
                      {ride.driver?.firstName} {ride.driver?.lastName}
                    </Text>
                    <Text style={[styles.rideDate, { color: T.textMuted }]}>
                      {formatDate(ride.createdAt)}
                    </Text>
                  </View>

                  <StatusBadge status={ride.status} T={T} />
                </View>

                {/* Locations */}
                <View
                  style={[
                    styles.locationsRow,
                    { borderTopColor: T.border },
                  ]}
                >
                  <View style={styles.locationItem}>
                    <Ionicons name="location" size={14} color={T.accent} />
                    <Text
                      style={[styles.locationText, { color: T.textMuted }]}
                      numberOfLines={1}
                    >
                      {ride.pickupAddress || "Pickup"}
                    </Text>
                  </View>

                  <Ionicons name="arrow-forward" size={12} color={T.textMuted} />

                  <View style={styles.locationItem}>
                    <Ionicons name="location-outline" size={14} color={T.success} />
                    <Text
                      style={[styles.locationText, { color: T.textMuted }]}
                      numberOfLines={1}
                    >
                      {ride.destinationAddress || "Destination"}
                    </Text>
                  </View>
                </View>

                {/* Price and Duration */}
                <View
                  style={[
                    styles.priceRow,
                    { borderTopColor: T.border },
                  ]}
                >
                  {ride.finalPrice && (
                    <Text style={[styles.price, { color: T.accent }]}>
                      ${ride.finalPrice.toFixed(2)}
                    </Text>
                  )}
                  {ride.completedAt && (
                    <Text style={[styles.duration, { color: T.textMuted }]}>
                      {Math.round(
                        (new Date(ride.completedAt) - new Date(ride.createdAt)) /
                          60000
                      )}{" "}
                      mins
                    </Text>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          )}
          renderSectionHeader={({ section: { title } }) => (
            <Text
              style={[
                styles.sectionHeader,
                { color: T.textMuted, backgroundColor: T.bg },
              ]}
            >
              {title}
            </Text>
          )}
          contentContainerStyle={{
            paddingHorizontal: 16,
            paddingVertical: 12,
            paddingBottom: 20,
          }}
          scrollEnabled={true}
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    flex: 1,
    textAlign: "center",
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 16,
    marginVertical: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 8,
    textAlign: "center",
  },
  emptyDesc: {
    fontSize: 14,
    textAlign: "center",
  },
  sectionHeader: {
    fontSize: 12,
    fontWeight: "600",
    paddingVertical: 8,
    paddingHorizontal: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rideCard: {
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    overflow: "hidden",
  },
  rideCardTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
  },
  driverAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  driverAvatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
  },
  driverInitials: {
    fontSize: 14,
    fontWeight: "700",
    color: "#fff",
  },
  driverName: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 2,
  },
  rideDate: {
    fontSize: 12,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    gap: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#fff",
  },
  locationsRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
    gap: 8,
  },
  locationItem: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  locationText: {
    fontSize: 12,
    flex: 1,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  price: {
    fontSize: 16,
    fontWeight: "700",
  },
  duration: {
    fontSize: 12,
  },
});

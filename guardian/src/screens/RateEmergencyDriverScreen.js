/**
 * screens/RateEmergencyDriverScreen.js
 *
 * Rate Emergency Driver
 * - Shows driver info and ride summary
 * - Star rating input (1-5)
 * - Optional comment field
 * - Submit rating to backend
 */

import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { Ionicons } from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../contexts/ThemeContext";
import { useDispatch, useSelector } from "react-redux";
import Toast from "react-native-toast-message";
import { rateEmergencyDriver } from "../lib/EmergencyRideSlice";
import { getInitials } from "../utils/helpers";

// Star Rating Input Component
const StarRatingInput = ({ rating, onRatingChange, T, size = 40 }) => {
  return (
    <View style={styles.starContainer}>
      {[1, 2, 3, 4, 5].map((star) => (
        <TouchableOpacity
          key={star}
          onPress={() => onRatingChange(star)}
          activeOpacity={0.7}
        >
          <Ionicons
            name={star <= rating ? "star" : "star-outline"}
            size={size}
            color={star <= rating ? "#f59e0b" : T.border}
          />
        </TouchableOpacity>
      ))}
    </View>
  );
};

export default function RateEmergencyDriverScreen({ navigation, route }) {
  const { theme: T } = useTheme();
  const insets = useSafeAreaInsets();
  const dispatch = useDispatch();

  const { rideId, ride, driver } = route.params || {};
  const { isSubmitting } = useSelector((state) => state.emergencyRides);

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");

  const handleSubmitRating = async () => {
    if (rating === 0) {
      Toast.show({
        type: "error",
        text1: "Select a Rating",
        text2: "Please select a rating before submitting",
      });
      return;
    }

    try {
      await dispatch(
        rateEmergencyDriver({
          rideId,
          rating,
          comment: comment.trim() || undefined,
        })
      );

      Toast.show({
        type: "success",
        text1: "Rating Submitted",
        text2: "Thank you for rating your driver",
      });

      setTimeout(() => {
        navigation.navigate("EmergencyRideMenu");
      }, 1500);
    } catch (error) {
      Toast.show({
        type: "error",
        text1: "Error",
        text2: error.message || "Could not submit rating",
      });
    }
  };

  const handleSkip = () => {
    Alert.alert(
      "Skip Rating",
      "Are you sure you want to skip rating this driver?",
      [
        { text: "Rate Now", style: "cancel" },
        {
          text: "Skip",
          style: "destructive",
          onPress: () => {
            navigation.navigate("EmergencyRideMenu");
          },
        },
      ]
    );
  };

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
        <View style={{ width: 24 }} />
        <Text style={[styles.headerTitle, { color: T.text }]}>
          Rate Your Driver
        </Text>
        <TouchableOpacity onPress={handleSkip} disabled={isSubmitting}>
          <Text style={[styles.skipButton, { color: T.accent, opacity: isSubmitting ? 0.5 : 1 }]}>
            Skip
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Driver Card */}
        <View
          style={[
            styles.driverCard,
            {
              backgroundColor: T.surface,
              borderColor: T.border,
            },
          ]}
        >
          {/* Driver Info */}
          <View style={styles.driverHeader}>
            {driver?.profileImage ? (
              <Image
                source={{ uri: driver.profileImage }}
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
                    (driver?.firstName || "") + " " + (driver?.lastName || "")
                  )}
                </Text>
              </View>
            )}

            <View style={{ flex: 1 }}>
              <Text style={[styles.driverName, { color: T.text }]}>
                {driver?.firstName} {driver?.lastName}
              </Text>
              {driver?.vehicle && (
                <Text style={[styles.vehicleInfo, { color: T.textMuted }]}>
                  {driver.vehicle.make} {driver.vehicle.model}
                </Text>
              )}
            </View>
          </View>

          {/* Ride Summary */}
          {ride && (
            <>
              <View style={[styles.divider, { backgroundColor: T.border }]} />

              <View style={styles.rideInfo}>
                <View style={styles.rideInfoRow}>
                  <Ionicons name="location" size={14} color={T.textMuted} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text
                      style={[styles.rideLabel, { color: T.textMuted }]}
                    >
                      From
                    </Text>
                    <Text
                      style={[styles.rideValue, { color: T.text }]}
                      numberOfLines={1}
                    >
                      {ride.pickupAddress || "N/A"}
                    </Text>
                  </View>
                </View>

                <View style={styles.rideInfoRow}>
                  <Ionicons name="location-outline" size={14} color={T.textMuted} />
                  <View style={{ flex: 1, marginLeft: 8 }}>
                    <Text
                      style={[styles.rideLabel, { color: T.textMuted }]}
                    >
                      To
                    </Text>
                    <Text
                      style={[styles.rideValue, { color: T.text }]}
                      numberOfLines={1}
                    >
                      {ride.destinationAddress || "N/A"}
                    </Text>
                  </View>
                </View>

                {ride.finalPrice && (
                  <View style={styles.rideInfoRow}>
                    <Ionicons name="cash-outline" size={14} color={T.textMuted} />
                    <View style={{ flex: 1, marginLeft: 8 }}>
                      <Text
                        style={[styles.rideLabel, { color: T.textMuted }]}
                      >
                        Price Paid
                      </Text>
                      <Text
                        style={[
                          styles.rideValue,
                          { color: T.text, fontWeight: "600" },
                        ]}
                      >
                        ${ride.finalPrice.toFixed(2)} {ride.currency || "USD"}
                      </Text>
                    </View>
                  </View>
                )}
              </View>
            </>
          )}
        </View>

        {/* Rating Section */}
        <View
          style={[
            styles.ratingSection,
            {
              backgroundColor: T.surface,
              borderColor: T.border,
            },
          ]}
        >
          <Text style={[styles.ratingTitle, { color: T.text }]}>
            How was your ride?
          </Text>

          <Text style={[styles.ratingSubtitle, { color: T.textMuted }]}>
            Your feedback helps us improve our service
          </Text>

          {/* Star Rating */}
          <View style={styles.starRatingContainer}>
            <StarRatingInput
              rating={rating}
              onRatingChange={setRating}
              T={T}
              size={48}
            />
          </View>

          {/* Rating Label */}
          {rating > 0 && (
            <View style={styles.ratingLabelContainer}>
              <Text style={[styles.ratingLabel, { color: T.accent }]}>
                {rating === 1 && "Poor"}
                {rating === 2 && "Fair"}
                {rating === 3 && "Good"}
                {rating === 4 && "Very Good"}
                {rating === 5 && "Excellent"}
              </Text>
            </View>
          )}
        </View>

        {/* Comment Section */}
        <View
          style={[
            styles.commentSection,
            {
              backgroundColor: T.surface,
              borderColor: T.border,
            },
          ]}
        >
          <Text style={[styles.commentLabel, { color: T.text }]}>
            Additional Comments (Optional)
          </Text>

          <TextInput
            style={[
              styles.commentInput,
              {
                backgroundColor: T.bg,
                borderColor: T.border,
                color: T.text,
              },
            ]}
            placeholder="Tell us more about your experience..."
            placeholderTextColor={T.textMuted}
            multiline
            maxLength={300}
            value={comment}
            onChangeText={setComment}
            editable={!isSubmitting}
          />

          <Text
            style={[
              styles.charCount,
              { color: T.textMuted },
            ]}
          >
            {comment.length}/300
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View
        style={[
          styles.footer,
          {
            paddingBottom: insets.bottom + 20,
            borderTopColor: T.border,
          },
        ]}
      >
        <TouchableOpacity
          onPress={handleSubmitRating}
          disabled={isSubmitting || rating === 0}
          style={{
            opacity: isSubmitting || rating === 0 ? 0.6 : 1,
          }}
        >
          <LinearGradient
            colors={["#ff6b6b", "#e83030"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.submitButton}
          >
            {isSubmitting ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Text style={styles.submitButtonText}>Submit Rating</Text>
                <Ionicons name="arrow-forward" size={18} color="#fff" />
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
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
  skipButton: {
    fontSize: 14,
    fontWeight: "500",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  driverCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  driverHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  driverAvatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  driverAvatarFallback: {
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
  },
  driverInitials: {
    fontSize: 20,
    fontWeight: "700",
    color: "#fff",
  },
  driverName: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 4,
  },
  vehicleInfo: {
    fontSize: 12,
  },
  divider: {
    height: 1,
    marginVertical: 12,
  },
  rideInfo: {
    gap: 12,
  },
  rideInfoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  rideLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  rideValue: {
    fontSize: 13,
    fontWeight: "500",
  },
  ratingSection: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    marginBottom: 16,
    alignItems: "center",
  },
  ratingTitle: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
    textAlign: "center",
  },
  ratingSubtitle: {
    fontSize: 13,
    marginBottom: 20,
    textAlign: "center",
  },
  starContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  starRatingContainer: {
    marginVertical: 12,
  },
  ratingLabelContainer: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  ratingLabel: {
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
  },
  commentSection: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 100,
  },
  commentLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10,
  },
  commentInput: {
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
    minHeight: 100,
    textAlignVertical: "top",
    fontSize: 14,
  },
  charCount: {
    fontSize: 12,
    marginTop: 6,
    textAlign: "right",
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    borderTopWidth: 1,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 16,
    borderRadius: 12,
    gap: 8,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#fff",
  },
});

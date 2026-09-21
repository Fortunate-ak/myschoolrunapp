import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Provider, useDispatch, useSelector } from "react-redux";
import { store } from "./src/store/store";
import { toastConfig } from "./src/config/toastConfig";
import Toast from "react-native-toast-message";
import Mapbox from "@rnmapbox/maps";
import { ActivityIndicator, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";

// ─── Theme ───────────────────────────────────────────────────────────────────
import { ThemeProvider, useTheme } from "./src/contexts/ThemeContext";

// Auth Screens
import LoginScreen from "./src/screens/LoginScreen";
import SignupScreen from "./src/screens/SignupScreen";
import OTPVerificationScreen from "./src/screens/OTPVerificationScreen";
import ResetPasswordScreen from "./src/screens/ResetPasswordScreen";
import ForgotPasswordScreen from "./src/screens/ForgotPasswordScreen";

// Guardian Flow Screens
import SetProfileScreen from "./src/screens/SetProfileScreen";
import FindDriverScreen from "./src/screens/FindDriverScreen";
import SubscriptionScreen from "./src/screens/SubscriptionScreen";
import MainTabs from "./src/navigation/MainTabs";

// Actions
import { getGuardianProfile, getGuardianStudents } from "./src/lib/UserSlice";
import { loadFromStorage } from "./src/lib/AuthSlice";

// Push notifications — prompts the user for permission and registers their
// Expo push token with the backend. Must run after we know the user is
// authenticated (registration is tied to the account), so it's called
// alongside the other post-login data loads below.
import { registerPushNotifications } from "./src/utils/notifications";

// Real-time tracking — connects the socket, joins rooms, and wires every
// inbound event (vehicle-started, vehicle-location-update, etc.) into
// Redux. Must be called once, high in the tree, for the whole
// authenticated session — NOT inside individual screens, or it will
// disconnect/reconnect every time the user navigates away and back.
import useGuardianSocket from "./src/hooks/useSocket";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_KEY);

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, user } = useSelector((state) => state.auth);
  const {
    guardianProfile,
    students,
    skippedFindDriver, // NEW — set by the Skip button on FindDriverScreen
    isLoading: guardianLoading,
  } = useSelector((state) => state.users);

  // ── Get theme for StatusBar ──────────────────────────────────────────────
  const { isDark } = useTheme();

  // Sets up the socket connection, joins the user's room + every tracked
  // vehicle's room, and dispatches all inbound tracking/notification/chat
  // events into Redux. The hook itself no-ops until a user is present, so
  // it's safe to call unconditionally here rather than gating on
  // isAuthenticated — that avoids tearing the socket down and rebuilding it
  // on every auth-state flicker (e.g. token refresh).
  useGuardianSocket();

  const [initialCheckDone, setInitialCheckDone] = useState(false);

  const hasProfile = guardianProfile && guardianProfile.id;
  const hasStudents = students && students.length > 0;
  // NOTE: isSubscribed is no longer used to gate navigation — it's only
  // relevant now at the point of a gated action (see useRequireSubscription,
  // once wired up). Kept here in case other parts of the tree read it from
  // this scope; safe to remove if unused elsewhere.
  const isSubscribed = guardianProfile?.isSubscribed || false;

  useEffect(() => {
    if (!isAuthenticated) {
      setInitialCheckDone(true);
      return;
    }
    setInitialCheckDone(false);

    const loadData = async () => {
      try {
        await Promise.all([
          dispatch(getGuardianProfile()),
          dispatch(getGuardianStudents()),
          dispatch(loadFromStorage()),
        ]);

        // Prompt for push notification permission (if not already
        // granted/denied) and register the token with the backend. This
        // is fire-and-forget: it shouldn't block or fail the initial
        // check, since a user who denies permission can still use the app.
        registerPushNotifications().catch((error) => {
          console.error("Error registering push notifications:", error);
        });
      } catch (error) {
        console.error("Error loading guardian data:", error);
      } finally {
        setInitialCheckDone(true);
      }
    };

    loadData();
  }, [isAuthenticated, dispatch]);

  if (!initialCheckDone) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#0d0d0d",
        }}
      >
        <ActivityIndicator color="#e83030" size="large" />
      </View>
    );
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#0d0d0d" },
      }}
    >
      {!isAuthenticated ? (
        // ── Auth Screens ──────────────────────────────────────────────────
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
          />
          <Stack.Screen name="ResetPassword" component={ResetPasswordScreen} />
          <Stack.Screen name="Signup" component={SignupScreen} />
          <Stack.Screen name="OTP" component={OTPVerificationScreen} />
        </>
      ) : !hasProfile ? (
        // ── Step 1: Set Profile ──────────────────────────────────────────
        <Stack.Screen name="GuardianSetProfile" component={SetProfileScreen} />
      ) : !hasStudents && !skippedFindDriver ? (
        // ── Step 2: Find Driver (skippable) ─────────────────────────────
        // Guardian can tap "Skip" on FindDriverScreen, which dispatches
        // skipFindDriver() and flips skippedFindDriver to true, dropping
        // them straight into Main. skippedFindDriver lives in Redux state
        // only (not persisted to storage), so it resets to false on every
        // fresh login / cold start — guardians are asked again next time,
        // rather than the skip being remembered forever.
        <Stack.Screen name="GuardianFindDriver" component={FindDriverScreen} />
      ) : (
        // ── Main App ─────────────────────────────────────────────────────
        // Subscription is now a sibling screen, reachable via
        // navigation.navigate("Subscription") from anywhere inside Main —
        // e.g. from a useRequireSubscription gate on a pickup-request
        // button — instead of being a mandatory step in this chain.
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="Subscription"
            component={SubscriptionScreen}
            options={{ presentation: "modal" }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <NavigationContainer>
            {/* StatusBar now reacts to theme changes */}
            <AppNavigatorWithStatusBar />
            <Toast config={toastConfig} />
          </NavigationContainer>
        </GestureHandlerRootView>
      </ThemeProvider>
    </Provider>
  );
}

// ── Separate component to use theme for StatusBar ──────────────────────────
function AppNavigatorWithStatusBar() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AppNavigator />
    </>
  );
}
// App.js
import React, { useEffect, useState } from "react";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { Provider, useDispatch, useSelector } from "react-redux";
import { store } from "./store/store";
import { toastConfig } from "./config/toastConfig";
import LoginScreen from "./screens/LoginScreen";
import SignupScreen from "./screens/SignupScreen";
import OTPVerificationScreen from "./screens/OTPVerificationScreen";
import RouteSelectionScreen from "./screens/RouteSelectionScreen";
import ResetPasswordScreen from "./screens/ResetPasswordScreen";
import ForgotPasswordScreen from "./screens/ForgotPasswordScreen";
import MainTabs from "./navigation/MainTabs";
import Toast from "react-native-toast-message";
import Mapbox from "@rnmapbox/maps";
import useSocketRedux from "./hooks/useSocket";
import { getVehicleRoutesForDriver } from "./lib/VehicleRoutesSlice";
import { ActivityIndicator, View } from "react-native";
import SetProfileScreen from "./screens/SetProfileScreen";
import SetRouteScreen from "./screens/SetRouteScreen";
import { getDriverProfile } from "./lib/UserSlice";
import { setHasSelectedRoute } from "./lib/AuthSlice";
import { GestureHandlerRootView } from "react-native-gesture-handler";

import { registerPushNotifications } from "./utils/notifications";

// ─── Theme ───────────────────────────────────────────────────────────────────
import { ThemeProvider, useTheme } from "./contexts/ThemeContext";

Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_KEY);

const Stack = createNativeStackNavigator();

function AppNavigator() {
  const dispatch = useDispatch();
  const { isAuthenticated, hasSelectedRoute } = useSelector(
    (state) => state.auth,
  );
  const { driverProfile, isLoading: profileLoading } = useSelector(
    (state) => state.users,
  );
  const { driverRoutes, isLoading: routesLoading } = useSelector(
    (state) => state.vehicleroutes,
  );
  
  const { isDark } = useTheme(); // For StatusBar and contentStyle

  const hasProfile = driverProfile && driverProfile.id;
  const hasRoutes = driverRoutes && driverRoutes.length > 0;

  const [initialCheckDone, setInitialCheckDone] = useState(false);
  const [onboardingDone, setOnboardingDone] = useState({
    profile: false,
    routes: false,
  });
  const [bypassRoutesSetup, setBypassRoutesSetup] = useState(false);
  const [bypassRouteSelection, setBypassRouteSelection] = useState(false);

  useEffect(() => {
    if (hasProfile) {
      setOnboardingDone((s) => (s.profile ? s : { ...s, profile: true }));
    }
  }, [hasProfile]);

  useEffect(() => {
    if (hasRoutes) {
      setOnboardingDone((s) => (s.routes ? s : { ...s, routes: true }));
    }
  }, [hasRoutes]);

  useEffect(() => {
    if (!isAuthenticated) {
      setOnboardingDone({ profile: false, routes: false });
      setBypassRoutesSetup(false);
      setBypassRouteSelection(false);
    }
  }, [isAuthenticated]);

  const profileComplete = hasProfile || onboardingDone.profile;
  const routesComplete = hasRoutes || onboardingDone.routes;

  useEffect(() => {
    if (!isAuthenticated) {
      setInitialCheckDone(true);
      return;
    }
    setInitialCheckDone(false);

    dispatch(setHasSelectedRoute(false));

    Promise.allSettled([
      dispatch(getVehicleRoutesForDriver()),
      dispatch(getDriverProfile()),
    ]).finally(() => setInitialCheckDone(true));

    // Fire-and-forget: prompt for push permission / register token. Not
    // included in the allSettled above so a slow or denied permission
    // prompt can't hold up initialCheckDone.
    registerPushNotifications().catch((error) => {
      console.error("Error registering push notifications:", error);
    });
  }, [isAuthenticated, dispatch]);

  if (!initialCheckDone) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: isDark ? "#0d0d0d" : "#f5f5f5",
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
        contentStyle: { backgroundColor: isDark ? "#0d0d0d" : "#f5f5f5" },
      }}
    >
      {!isAuthenticated ? (
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
      ) : !profileComplete ? (
        <Stack.Screen name="SetProfile" component={SetProfileScreen} />
      ) : !routesComplete && !bypassRoutesSetup ? (
        <Stack.Screen name="SetRoute">
          {(props) => (
            <SetRouteScreen
              {...props}
              onSkip={() => setBypassRoutesSetup(true)}
            />
          )}
        </Stack.Screen>
      ) : !hasSelectedRoute && !bypassRouteSelection ? (
        <Stack.Screen name="RouteSelection">
          {(props) => (
            <RouteSelectionScreen
              {...props}
              onSkip={() => setBypassRouteSelection(true)}
            />
          )}
        </Stack.Screen>
      ) : (
        <Stack.Screen name="Main" component={MainTabs} />
      )}
    </Stack.Navigator>
  );
}

// ── Wrapper to set StatusBar dynamically ────────────────────────────────────
function AppWithStatusBar() {
  const { isDark } = useTheme();
  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <AppNavigator />
    </>
  );
}

export default function App() {
  return (
    <Provider store={store}>
      <ThemeProvider>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <NavigationContainer>
            <AppWithStatusBar />
            <Toast config={toastConfig} />
          </NavigationContainer>
        </GestureHandlerRootView>
      </ThemeProvider>
    </Provider>
  );
}

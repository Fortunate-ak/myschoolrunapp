import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useMemo,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEY = "app_theme_preference";

// ─── Palettes ──────────────────────────────────────────────────────────────────
const dark = {
  mode: "dark",
  // Backgrounds
  bg: "#0d0d0d",
  bgSecondary: "#111111",
  surface: "#161616",
  surfaceRaised: "#1e1e1e",
  // Text
  text: "#ffffff",
  textSecondary: "rgba(255,255,255,0.65)",
  textMuted: "rgba(255,255,255,0.4)",
  textDisabled: "rgba(255,255,255,0.2)",
  // Borders
  border: "rgba(255,255,255,0.07)",
  borderStrong: "rgba(255,255,255,0.14)",
  // Accent
  accent: "#e83030",
  accentDim: "rgba(232,48,48,0.12)",
  accentBorder: "rgba(232,48,48,0.25)",
  // Status
  success: "#22c55e",
  successDim: "rgba(34,197,94,0.12)",
  warning: "#f59e0b",
  warningDim: "rgba(245,158,11,0.12)",
  info: "#3b82f6",
  infoDim: "rgba(59,130,246,0.12)",
  // Map overlay
  mapOverlay: "rgba(0,0,0,0.65)",
  // Tab bar
  tabBar: "#111111",
  tabBarBorder: "rgba(255,255,255,0.07)",
  // Input
  inputBg: "#1a1a1a",
  inputBorder: "rgba(255,255,255,0.08)",
  placeholder: "rgba(255,255,255,0.25)",
};

const light = {
  mode: "light",
  bg: "#f5f5f5",
  bgSecondary: "#eeeeee",
  surface: "#ffffff",
  surfaceRaised: "#f9f9f9",
  text: "#111111",
  textSecondary: "rgba(0,0,0,0.65)",
  textMuted: "rgba(0,0,0,0.45)",
  textDisabled: "rgba(0,0,0,0.25)",
  border: "rgba(0,0,0,0.08)",
  borderStrong: "rgba(0,0,0,0.15)",
  accent: "#e83030",
  accentDim: "rgba(232,48,48,0.1)",
  accentBorder: "rgba(232,48,48,0.25)",
  success: "#16a34a",
  successDim: "rgba(22,163,74,0.1)",
  warning: "#d97706",
  warningDim: "rgba(217,119,6,0.1)",
  info: "#2563eb",
  infoDim: "rgba(37,99,235,0.1)",
  mapOverlay: "rgba(255,255,255,0.88)",
  tabBar: "#ffffff",
  tabBarBorder: "rgba(0,0,0,0.08)",
  inputBg: "#f0f0f0",
  inputBorder: "rgba(0,0,0,0.1)",
  placeholder: "rgba(0,0,0,0.3)",
};

// ─── Context ──────────────────────────────────────────────────────────────────
const ThemeContext = createContext({
  theme: dark,
  isDark: true,
  preference: "system", // "dark" | "light" | "system"
  setPreference: () => {},
});

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme(); // "dark" | "light" | null
  const [preference, setPreferenceState] = useState("system");

  // Load saved preference once on mount
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((val) => {
        if (val === "dark" || val === "light" || val === "system") {
          setPreferenceState(val);
        }
      })
      .catch(() => {});
  }, []);

  const setPreference = async (val) => {
    setPreferenceState(val);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, val);
    } catch (_) {}
  };

  const isDark = useMemo(() => {
    if (preference === "dark") return true;
    if (preference === "light") return false;
    return systemScheme !== "light"; // default to dark if system is unknown
  }, [preference, systemScheme]);

  const theme = isDark ? dark : light;

  const value = useMemo(
    () => ({ theme, isDark, preference, setPreference }),
    [theme, isDark, preference],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

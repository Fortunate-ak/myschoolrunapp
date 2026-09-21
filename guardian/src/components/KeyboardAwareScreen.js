// components/KeyboardAwareScreen.js
//
// Drop-in wrapper for any screen with text inputs (login, signup, add
// payment method, etc.) so the keyboard never covers the field the user is
// typing into. Wrap your existing screen content with this instead of a
// bare <ScrollView> or <View>.
//
// Usage:
//   import KeyboardAwareScreen from "../components/KeyboardAwareScreen";
//
//   export default function LoginScreen() {
//     return (
//       <KeyboardAwareScreen>
//         <TextInput ... />
//         <TextInput ... />
//         <TouchableOpacity ...><Text>Log In</Text></TouchableOpacity>
//       </KeyboardAwareScreen>
//     );
//   }

import React from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
} from "react-native";

export default function KeyboardAwareScreen({
  children,
  style,
  contentContainerStyle,
  // Extra vertical offset if your screen has a fixed header overlapping
  // the KeyboardAvoidingView — pass headerHeight if you have one.
  keyboardVerticalOffset = 0,
}) {
  return (
    <KeyboardAvoidingView
      style={[styles.flex, style]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, contentContainerStyle]}
        // Lets the user tap another input (or a button) without needing to
        // dismiss the keyboard first — the single biggest UX fix for forms.
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: 24 },
});

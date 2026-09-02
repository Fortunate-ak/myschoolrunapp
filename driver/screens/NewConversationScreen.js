import React, { useCallback, useEffect, useState } from "react";
import {
  Text,
  StyleSheet,
  View,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from "react-native";
import Ionicons from "@react-native-vector-icons/ionicons";
import { useDispatch, useSelector } from "react-redux";
import { useTheme } from "../contexts/ThemeContext";
import {
  fetchDriverRouteChannels,
  fetchRouteGuardians,
  createRouteChannel,
  getorCreatePrivateConversation,
  selectDriverRouteChannels,
  selectIsLoadingDriverRoutes,
  selectRouteGuardians,
  selectRouteGuardiansRouteId,
  selectIsLoadingRouteGuardians,
} from "../lib/MessagesSlice";

const TABS = { ROUTES: "routes", GUARDIANS: "guardians" };

export default function NewConversationScreen({ navigation }) {
  const { theme } = useTheme();
  const dispatch = useDispatch();

  const [activeTab, setActiveTab] = useState(TABS.ROUTES);
  // The route the driver has drilled into on the Guardians tab (null = still
  // picking which route's guardians to browse).
  const [selectedRoute, setSelectedRoute] = useState(null);
  // routeId currently being created, so we can show a per-row spinner.
  const [creatingRouteId, setCreatingRouteId] = useState(null);
  // guardian userId currently being messaged, likewise for a per-row spinner.
  const [startingUserId, setStartingUserId] = useState(null);

  const routes = useSelector(selectDriverRouteChannels);
  const isLoadingRoutes = useSelector(selectIsLoadingDriverRoutes);
  const guardians = useSelector(selectRouteGuardians);
  const guardiansRouteId = useSelector(selectRouteGuardiansRouteId);
  const isLoadingGuardians = useSelector(selectIsLoadingRouteGuardians);

  useEffect(() => {
    dispatch(fetchDriverRouteChannels());
  }, [dispatch]);

  const openChat = useCallback(
    (conversationId, title) => {
      navigation.replace("ChatThread", { conversationId, title });
    },
    [navigation],
  );

  // ── Route channels ─────────────────────────────────────────────────────────
  const handleRoutePress = useCallback(
    async (route) => {
      if (route.hasChannel && route.conversationId) {
        openChat(route.conversationId, `${route.routeName}`);
        return;
      }

      setCreatingRouteId(route.routeId);
      const result = await dispatch(
        createRouteChannel({ routeId: route.routeId }),
      );
      setCreatingRouteId(null);

      if (createRouteChannel.fulfilled.match(result)) {
        // Refetch routes to update the channel status
        await dispatch(fetchDriverRouteChannels());
        const conversation = result.payload;
        openChat(conversation.id, conversation.name);
      }
    },
    [dispatch, openChat],
  );

  // ── Guardians ───────────────────────────────────────────────────────────────
  const handleSelectRouteForGuardians = useCallback(
    (route) => {
      setSelectedRoute(route);
      dispatch(fetchRouteGuardians(route.routeId));
    },
    [dispatch],
  );

  const handleBackToRoutes = useCallback(() => {
    setSelectedRoute(null);
  }, []);

  const handleGuardianPress = useCallback(
    async (guardian) => {
      if (guardian.existingConversationId) {
        openChat(guardian.existingConversationId, guardian.name);
        return;
      }

      setStartingUserId(guardian.userId);
      const result = await dispatch(
        getorCreatePrivateConversation(guardian.userId),
      );
      setStartingUserId(null);

      if (getorCreatePrivateConversation.fulfilled.match(result)) {
        const conversation = result.payload;
        openChat(
          conversation.id,
          conversation.otherParticipant?.fullname || guardian.name,
        );
      }
    },
    [dispatch, openChat],
  );

  const handleTabPress = (tab) => {
    setActiveTab(tab);
    setSelectedRoute(null);
  };

  // ── Renderers ────────────────────────────────────────────────────────────
  const renderRouteRow = ({ item }, { forGuardians = false } = {}) => {
    const isCreating = creatingRouteId === item.routeId;
    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: theme.border }]}
        activeOpacity={0.7}
        disabled={isCreating}
        onPress={() =>
          forGuardians
            ? handleSelectRouteForGuardians(item)
            : handleRoutePress(item)
        }
      >
        <View
          style={[
            styles.iconBubble,
            {
              backgroundColor: theme.accentDim,
              borderColor: theme.accentBorder,
            },
          ]}
        >
          <Ionicons name="bus" size={20} color={theme.accent} />
        </View>

        <View style={styles.rowBody}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {item.routeName}
          </Text>
          <Text style={[styles.subtext, { color: theme.textMuted }]}>
            {item.registrationNumber}
            {forGuardians
              ? ""
              : item.hasChannel
                ? " · Channel exists"
                : " · No channel yet"}
          </Text>
        </View>

        {isCreating ? (
          <ActivityIndicator color={theme.accent} size="small" />
        ) : (
          <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
        )}
      </TouchableOpacity>
    );
  };

  const renderGuardianRow = ({ item }) => {
    const isStarting = startingUserId === item.userId;
    return (
      <TouchableOpacity
        style={[styles.row, { borderBottomColor: theme.border }]}
        activeOpacity={0.7}
        disabled={isStarting}
        onPress={() => handleGuardianPress(item)}
      >
        <View
          style={[
            styles.iconBubble,
            {
              backgroundColor: theme.accentDim,
              borderColor: theme.accentBorder,
            },
          ]}
        >
          <Ionicons name="person" size={20} color={theme.accent} />
        </View>

        <View style={styles.rowBody}>
          <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text
            style={[styles.subtext, { color: theme.textMuted }]}
            numberOfLines={1}
          >
            {item.relationship} of {item.studentName}
          </Text>
        </View>

        {isStarting ? (
          <ActivityIndicator color={theme.accent} size="small" />
        ) : (
          <Ionicons
            name={
              item.existingConversationId
                ? "chatbubble-outline"
                : "add-circle-outline"
            }
            size={20}
            color={theme.accent}
          />
        )}
      </TouchableOpacity>
    );
  };

  const guardiansLoadedForSelectedRoute =
    selectedRoute && guardiansRouteId === selectedRoute.routeId;

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <View style={[styles.tabBar, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => handleTabPress(TABS.ROUTES)}
        >
          <Text
            style={[
              styles.tabLabel,
              {
                color:
                  activeTab === TABS.ROUTES ? theme.accent : theme.textMuted,
                fontWeight: activeTab === TABS.ROUTES ? "700" : "500",
              },
            ]}
          >
            Route Channels
          </Text>
          {activeTab === TABS.ROUTES && (
            <View
              style={[styles.tabIndicator, { backgroundColor: theme.accent }]}
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.tabButton}
          onPress={() => handleTabPress(TABS.GUARDIANS)}
        >
          <Text
            style={[
              styles.tabLabel,
              {
                color:
                  activeTab === TABS.GUARDIANS ? theme.accent : theme.textMuted,
                fontWeight: activeTab === TABS.GUARDIANS ? "700" : "500",
              },
            ]}
          >
            Guardians
          </Text>
          {activeTab === TABS.GUARDIANS && (
            <View
              style={[styles.tabIndicator, { backgroundColor: theme.accent }]}
            />
          )}
        </TouchableOpacity>
      </View>

      {activeTab === TABS.ROUTES ? (
        isLoadingRoutes && routes.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={theme.accent} size="large" />
          </View>
        ) : (
          <FlatList
            data={routes}
            keyExtractor={(item) => String(item.routeId)}
            renderItem={(props) =>
              renderRouteRow(props, { forGuardians: false })
            }
            contentContainerStyle={
              routes.length === 0 ? { flexGrow: 1 } : undefined
            }
            ListEmptyComponent={
              <View style={styles.center}>
                <Text style={{ color: theme.textMuted }}>
                  No routes assigned yet
                </Text>
              </View>
            }
          />
        )
      ) : selectedRoute ? (
        <View style={{ flex: 1 }}>
          <TouchableOpacity style={styles.backRow} onPress={handleBackToRoutes}>
            <Ionicons name="chevron-back" size={18} color={theme.accent} />
            <Text style={[styles.backText, { color: theme.accent }]}>
              {selectedRoute.routeName}
            </Text>
          </TouchableOpacity>

          {isLoadingGuardians && !guardiansLoadedForSelectedRoute ? (
            <View style={styles.center}>
              <ActivityIndicator color={theme.accent} size="large" />
            </View>
          ) : (
            <FlatList
              data={guardiansLoadedForSelectedRoute ? guardians : []}
              keyExtractor={(item) => String(item.guardianId)}
              renderItem={renderGuardianRow}
              contentContainerStyle={
                guardians.length === 0 ? { flexGrow: 1 } : undefined
              }
              ListEmptyComponent={
                <View style={styles.center}>
                  <Text style={{ color: theme.textMuted }}>
                    No guardians found for this route
                  </Text>
                </View>
              }
            />
          )}
        </View>
      ) : isLoadingRoutes && routes.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator color={theme.accent} size="large" />
        </View>
      ) : (
        <FlatList
          data={routes}
          keyExtractor={(item) => String(item.routeId)}
          renderItem={(props) => renderRouteRow(props, { forGuardians: true })}
          contentContainerStyle={
            routes.length === 0 ? { flexGrow: 1 } : undefined
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={{ color: theme.textMuted }}>
                No routes assigned yet
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  tabButton: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
  },
  tabLabel: { fontSize: 14 },
  tabIndicator: {
    marginTop: 8,
    height: 2,
    width: 32,
    borderRadius: 1,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backText: { fontSize: 14, fontWeight: "600", marginLeft: 4 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  iconBubble: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    marginRight: 12,
  },
  rowBody: { flex: 1 },
  name: { fontSize: 15, fontWeight: "600", marginBottom: 2 },
  subtext: { fontSize: 12 },
});

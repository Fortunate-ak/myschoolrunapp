import React, { useState, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  FlatList,
  ActivityIndicator,
  Dimensions,
  Platform,
} from "react-native";
import Mapbox from "@rnmapbox/maps";
import Ionicons from "@react-native-vector-icons/ionicons";
import { LinearGradient } from "expo-linear-gradient";
import { forwardGeocode, reverseGeocode } from "../utils/mapbox";

const { height } = Dimensions.get("window");

const DEFAULT_CENTER = [31.0335, -17.8252];

export default function MapStopPicker({
  visible,
  onClose,
  onConfirm,
  initialCoordinate, // { latitude, longitude } | null
}) {
  const cameraRef = useRef(null);
  const [searchText, setSearchText] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState(
    initialCoordinate
      ? {
          latitude: initialCoordinate.latitude,
          longitude: initialCoordinate.longitude,
          name: "Selected location",
          address: "",
        }
      : null,
  );
  const [resolving, setResolving] = useState(false);
  const searchDebounce = useRef(null);

  const handleSearchChange = (text) => {
    setSearchText(text);
    if (searchDebounce.current) clearTimeout(searchDebounce.current);

    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    searchDebounce.current = setTimeout(async () => {
      try {
        setSearching(true);
        const results = await forwardGeocode(text, {
          proximity: selected
            ? [selected.longitude, selected.latitude]
            : DEFAULT_CENTER,
        });
        setSearchResults(results);
      } catch (e) {
        console.warn("Forward geocode error:", e.message);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const handleSelectResult = (item) => {
    setSelected(item);
    setSearchResults([]);
    setSearchText(item.address);
    cameraRef.current?.setCamera({
      centerCoordinate: [item.longitude, item.latitude],
      zoomLevel: 15,
      animationDuration: 600,
    });
  };

  // Tap on map -> reverse geocode the dropped pin
  const handleMapPress = useCallback(async (feature) => {
    const [longitude, latitude] = feature.geometry.coordinates;
    setSelected({ latitude, longitude, name: "Locating…", address: "" });
    setResolving(true);
    try {
      const place = await reverseGeocode(latitude, longitude);
      setSelected({
        latitude,
        longitude,
        name: place.name,
        address: place.address,
      });
      setSearchText(place.address);
    } catch (e) {
      setSelected({
        latitude,
        longitude,
        name: "Dropped pin",
        address: `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`,
      });
    } finally {
      setResolving(false);
    }
  }, []);

  const handleConfirm = () => {
    if (!selected) return;
    onConfirm({
      stopName: selected.name,
      location: {
        latitude: selected.latitude,
        longitude: selected.longitude,
        address: selected.address,
      },
      scheduledPickupTime: null,
      scheduledDropoffTime: null,
      estimatedWaitTime: 2,
    });
    handleClose();
  };

  const handleClose = () => {
    setSearchText("");
    setSearchResults([]);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={handleClose}>
      <View style={styles.container}>
        {/* Header / search bar */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.iconBtn} onPress={handleClose}>
            <Ionicons name="close" size={22} color="#fff" />
          </TouchableOpacity>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={16} color="rgba(255,255,255,0.4)" />
            <TextInput
              style={styles.searchInput}
              placeholder="Search for a place or address"
              placeholderTextColor="rgba(255,255,255,0.3)"
              value={searchText}
              onChangeText={handleSearchChange}
            />
            {searching && <ActivityIndicator size="small" color="#e83030" />}
          </View>
        </View>

        {/* Search results dropdown */}
        {searchResults.length > 0 && (
          <View style={styles.resultsList}>
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.resultRow}
                  onPress={() => handleSelectResult(item)}
                >
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color="#e83030"
                    style={{ marginRight: 10 }}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.resultName}>{item.name}</Text>
                    <Text style={styles.resultAddress} numberOfLines={1}>
                      {item.address}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {/* Map */}
        <View style={styles.mapWrap}>
          <Mapbox.MapView
            style={styles.map}
            styleURL={Mapbox.StyleURL.Dark}
            onPress={handleMapPress}
          >
            <Mapbox.Camera
              ref={cameraRef}
              zoomLevel={selected ? 15 : 12}
              centerCoordinate={
                selected
                  ? [selected.longitude, selected.latitude]
                  : DEFAULT_CENTER
              }
              animationMode="flyTo"
              animationDuration={500}
            />
            {selected && (
              <Mapbox.PointAnnotation
                id="selected-stop"
                coordinate={[selected.longitude, selected.latitude]}
              >
                <View style={styles.markerOuter}>
                  <View style={styles.markerInner} />
                </View>
              </Mapbox.PointAnnotation>
            )}
          </Mapbox.MapView>

          {/* Crosshair hint when nothing selected */}
          {!selected && (
            <View style={styles.hintBadge}>
              <Ionicons name="hand-left-outline" size={14} color="#fff" />
              <Text style={styles.hintText}>Tap the map to drop a pin</Text>
            </View>
          )}
        </View>

        {/* Bottom confirm sheet */}
        <View style={styles.bottomSheet}>
          {selected ? (
            <>
              <View style={styles.selectedRow}>
                <View style={styles.selectedIconBg}>
                  <Ionicons name="location" size={18} color="#e83030" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.selectedName} numberOfLines={1}>
                    {resolving ? "Locating…" : selected.name}
                  </Text>
                  <Text style={styles.selectedAddress} numberOfLines={1}>
                    {resolving
                      ? "Resolving address"
                      : selected.address ||
                        `${selected.latitude.toFixed(5)}, ${selected.longitude.toFixed(5)}`}
                  </Text>
                </View>
              </View>

              <TouchableOpacity
                onPress={handleConfirm}
                activeOpacity={0.85}
                disabled={resolving}
                style={[styles.confirmBtn, resolving && { opacity: 0.6 }]}
              >
                <LinearGradient
                  colors={["#e83030", "#c01818"]}
                  style={styles.confirmBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.confirmBtnText}>Use This Location</Text>
                  <Ionicons name="checkmark" size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </>
          ) : (
            <Text style={styles.placeholderHint}>
              Search above or tap anywhere on the map to choose a stop location.
            </Text>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0d0d0d" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingTop: Platform.OS === "ios" ? 56 : 40,
    paddingBottom: 12,
    backgroundColor: "#0d0d0d",
    zIndex: 5,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },
  searchWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#1a1a1a",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 12,
    height: 42,
  },
  searchInput: {
    flex: 1,
    color: "#fff",
    fontSize: 14,
  },

  resultsList: {
    position: "absolute",
    top: Platform.OS === "ios" ? 104 : 88,
    left: 16,
    right: 16,
    backgroundColor: "#161616",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    maxHeight: 240,
    zIndex: 10,
    elevation: 10,
  },
  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255,255,255,0.05)",
  },
  resultName: { color: "#fff", fontSize: 13, fontWeight: "600" },
  resultAddress: { color: "rgba(255,255,255,0.4)", fontSize: 11, marginTop: 2 },

  mapWrap: { flex: 1 },
  map: { flex: 1 },

  markerOuter: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "rgba(232,48,48,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  markerInner: {
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: "#e83030",
    borderWidth: 2,
    borderColor: "#fff",
  },

  hintBadge: {
    position: "absolute",
    top: 14,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.6)",
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
  },
  hintText: { color: "#fff", fontSize: 11, fontWeight: "500" },

  bottomSheet: {
    backgroundColor: "#141010",
    borderTopWidth: 1,
    borderTopColor: "rgba(255,255,255,0.08)",
    padding: 18,
    paddingBottom: Platform.OS === "ios" ? 32 : 18,
    minHeight: 130,
  },
  placeholderHint: {
    fontSize: 13,
    color: "rgba(255,255,255,0.35)",
    textAlign: "center",
    paddingVertical: 18,
  },

  selectedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginBottom: 16,
  },
  selectedIconBg: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(232,48,48,0.12)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(232,48,48,0.2)",
  },
  selectedName: { color: "#fff", fontSize: 14, fontWeight: "700" },
  selectedAddress: {
    color: "rgba(255,255,255,0.4)",
    fontSize: 12,
    marginTop: 2,
  },

  confirmBtn: { borderRadius: 50, overflow: "hidden" },
  confirmBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 15,
  },
  confirmBtnText: { color: "#fff", fontSize: 15, fontWeight: "700" },
});

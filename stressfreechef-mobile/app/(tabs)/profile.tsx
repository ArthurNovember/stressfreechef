import Constants from "expo-constants";
import React, { useCallback, useEffect, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
  ScrollView,
  Modal,
} from "react-native";
import { useFocusEffect } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE, fetchJSON } from "../../lib/api";

const BASE = API_BASE || "https://stressfreecheff-backend.onrender.com";

import { router } from "expo-router";

/** ===== Helpers ===== */
const TOKEN_KEY = "token";
async function getToken() {
  return (await AsyncStorage.getItem(TOKEN_KEY)) || "";
}
async function setToken(t: string) {
  await AsyncStorage.setItem(TOKEN_KEY, t);
}
async function clearToken() {
  await AsyncStorage.removeItem(TOKEN_KEY);
}

function isVideo(url = "") {
  return /(\.mp4|\.webm|\.mov|\.m4v)(\?|#|$)/i.test(url);
}

function getCover(r: any) {
  const url =
    r?.image?.url ||
    r?.imgSrc ||
    (r?.steps || []).find((s: any) => s?.type === "image" && s?.src)?.src ||
    (r?.steps || []).find((s: any) => s?.src)?.src ||
    "https://i.imgur.com/CZaFjz2.png"; // placeholder
  return { url, isVideo: isVideo(url) };
}

// Pomůcka na rozpoznání „neautorizován“
const isUnauthorizedError = (e: any) => {
  const msg = String(e?.message ?? e ?? "");
  // naše fetchJSON hází "HTTP 401: ..." – zároveň pokryjeme text tokenu
  return (
    /\\b401\\b/i.test(msg) ||
    /unauthor/i.test(msg) ||
    (/token/i.test(msg) && /invalid|expire|platn/i.test(msg))
  );
};

/** ===== AuthForm (RN) ===== */
function AuthFormRN({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function handleSignup() {
    if (password !== confirm) {
      Alert.alert("Passwords do not match.");
      return;
    }
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/api/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, password }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(String(data?.error || "Registration error."));
      Alert.alert("Registration successful", "You can log in now.");
      setMode("login");
    } catch (e: any) {
      Alert.alert("Registration failed", e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin() {
    try {
      setBusy(true);
      const res = await fetch(`${API_BASE}/api/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok || !data?.token)
        throw new Error(String(data?.error || "Login error."));
      await setToken(String(data.token));
      Alert.alert("Login successful");
      onLoggedIn();
    } catch (e: any) {
      Alert.alert("Login failed", e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <ScrollView
      contentContainerStyle={styles.authWrap}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.authSwitchRow}>
        <Pressable
          onPress={() => setMode("signup")}
          style={[
            styles.switchBtn,
            mode === "signup" && styles.switchBtnActive,
          ]}
        >
          <Text style={styles.switchText}>SIGN UP</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("login")}
          style={[styles.switchBtn, mode === "login" && styles.switchBtnActive]}
        >
          <Text style={styles.switchText}>LOG IN</Text>
        </Pressable>
      </View>

      {mode === "signup" && (
        <View style={styles.form}>
          <Text style={styles.label}>Username</Text>
          <TextInput
            style={styles.input}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
          />
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Text style={styles.label}>Confirm password</Text>
          <TextInput
            style={styles.input}
            value={confirm}
            onChangeText={setConfirm}
            secureTextEntry
          />
          <Pressable
            disabled={busy}
            onPress={handleSignup}
            style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
          >
            <Text style={styles.primaryBtnText}>
              {busy ? "Please wait…" : "SIGN UP"}
            </Text>
          </Pressable>
        </View>
      )}

      {mode === "login" && (
        <View style={styles.form}>
          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          <Pressable
            disabled={busy}
            onPress={handleLogin}
            style={[styles.primaryBtn, busy && { opacity: 0.7 }]}
          >
            <Text style={styles.primaryBtnText}>
              {busy ? "Please wait…" : "LOG IN"}
            </Text>
          </Pressable>
        </View>
      )}
    </ScrollView>
  );
}

/** ===== MyProfile (RN) ===== */
function MyProfileRN({ onLoggedOut }: { onLoggedOut: () => void }) {
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [selected, setSelected] = useState<any | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setErr(null);
    try {
      const token = await getToken();
      if (!token) throw new Error("Missing token");

      try {
        const me = await fetchJSON(`${API_BASE}/api/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(me || null);
      } catch {
        setUser(null);
      }

      const mine = await fetchJSON<{ items?: any[] }>(
        `${API_BASE}/api/my-recipes?page=1&limit=50`,
        {
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${token}`,
          },
        }
      );
      setItems(Array.isArray(mine?.items) ? mine.items : []);
    } catch (e: any) {
      if (isUnauthorizedError(e)) {
        await clearToken();
        onLoggedOut();
        return;
      }
      setErr(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  }, [onLoggedOut]);

  useFocusEffect(
    useCallback(() => {
      loadAll();
    }, [loadAll])
  );

  const handleLogout = useCallback(async () => {
    await clearToken();
    onLoggedOut();
  }, [onLoggedOut]);

  const handleDeleteAccount = useCallback(async () => {
    Alert.alert(
      "Delete account",
      "This will permanently delete your account, recipes, shopping list and favorites. This action cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await getToken();
              const res = await fetch(`${API_BASE}/api/account`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` },
              });
              if (!res.ok && res.status !== 204) {
                const txt = await res.text();
                throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
              }
              await clearToken();
              onLoggedOut();
            } catch (e: any) {
              Alert.alert("Account deletion failed", e?.message || String(e));
            }
          },
        },
      ]
    );
  }, [onLoggedOut]);

  const handleDeleteRecipe = useCallback(async (id: string) => {
    Alert.alert("Delete recipe?", "This cannot be undone.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await getToken();
            const res = await fetch(`${API_BASE}/api/my-recipes/${id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) {
              const txt = await res.text();
              throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
            }
            setItems((prev) => prev.filter((r) => r?._id !== id));
          } catch (e: any) {
            Alert.alert("Deletion failed", e?.message || String(e));
          }
        },
      },
    ]);
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Loading…</Text>
      </View>
    );
  }

  if (err) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>Error: {err}</Text>
        <Pressable
          onPress={loadAll}
          style={[styles.primaryBtn, { marginTop: 12 }]}
        >
          <Text style={styles.primaryBtnText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: "#0f0f0fff", paddingTop: 15 }}>
      <View style={styles.profileHeader}>
        <View style={{ flex: 1 }}>
          <Text style={styles.welcome}>
            Welcome{user?.username ? `, ${user.username}` : ""}!
          </Text>
          {user?.email ? (
            <Text style={styles.metaText}>Email: {user.email}</Text>
          ) : null}
        </View>
        <View style={{ flexDirection: "row", gap: 8 }}>
          <Pressable onPress={handleLogout} style={styles.secondaryBtn}>
            <Text style={styles.secondaryBtnText}>Logout</Text>
          </Pressable>
          <Pressable
            onPress={handleDeleteAccount}
            style={[styles.secondaryBtn, { borderColor: "#b00020" }]}
          >
            <Text style={[styles.secondaryBtnText, { color: "#ff6666" }]}>
              Delete Account
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.sectionTitle}>MY RECIPES</Text>
      {items.length === 0 ? (
        <Text style={{ opacity: 0.7, paddingHorizontal: 16, color: "white" }}>
          You don’t have any recipes yet. Add your first one!
        </Text>
      ) : null}

      <FlatList
        data={items}
        keyExtractor={(r) => String(r?._id || r?.id)}
        contentContainerStyle={{ padding: 12, gap: 12 }}
        renderItem={({ item }) => {
          const { url } = getCover(item);
          const rid = String(item?._id || item?.id || "");
          return (
            <View style={styles.card}>
              <Pressable
                style={{ flex: 1, flexDirection: "row" }}
                onPress={() => setSelected({ ...item, imgSrc: url })}
              >
                <Image source={{ uri: url }} style={styles.cardImg} />
                <View style={{ flex: 1, paddingHorizontal: 10 }}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item?.title || "Untitled"}
                  </Text>
                  <Text style={styles.metaText}>
                    Difficulty: {item?.difficulty || "—"}
                  </Text>
                  <Text style={styles.metaText}>
                    Time: {item?.time || "—"} ⏱️
                  </Text>
                </View>
              </Pressable>
              <Pressable
                onPress={() => handleDeleteRecipe(String(item?._id))}
                style={styles.deleteBtn}
              >
                <Text style={{ color: "#fff", fontWeight: "700" }}>✕</Text>
              </Pressable>
            </View>
          );
        }}
      />
      {/* Modal s náhledem receptu */}
      <Modal
        visible={!!selected}
        animationType="slide"
        transparent
        onRequestClose={() => setSelected(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <ScrollView contentContainerStyle={{ paddingBottom: 16 }}>
              <Image
                source={{ uri: selected?.imgSrc }}
                style={styles.modalImg}
              />
              <Text style={styles.modalTitle}>{selected?.title}</Text>
              {selected?.ingredients?.length ? (
                <>
                  <Text style={styles.section}>Ingredients</Text>
                  {selected!.ingredients!.map((ing: string, i: number) => (
                    <Text key={i} style={styles.ingredient}>
                      • {ing}
                    </Text>
                  ))}
                </>
              ) : null}

              <Pressable
                style={styles.primaryBtn}
                onPress={() => {
                  // přejít na detail se „steps“
                  const rid = String(selected?._id || selected?.id || "");
                  router.push({
                    pathname: "/recipe/[id]",
                    params: {
                      id: rid,
                      // POZN: dočasně předáme i celý recipe (kvůli rychlosti),
                      // později uděláme fetch na detail podle id:
                      recipe: JSON.stringify(selected),
                    },
                  });
                  setSelected(null);
                }}
              >
                <Text style={styles.primaryBtnText}>GET STARTED</Text>
              </Pressable>
              <Pressable
                style={styles.secondaryBtn}
                onPress={() => setSelected(null)}
              >
                <Text style={styles.secondaryBtnText}>Close</Text>
              </Pressable>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/** ===== Profile root ===== */
export default function ProfileScreen() {
  const [hasToken, setHasToken] = useState<boolean | null>(null);

  const refreshAuth = useCallback(async () => {
    const t = await getToken();
    setHasToken(Boolean(t));
  }, []);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  if (hasToken === null) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return hasToken ? (
    <MyProfileRN onLoggedOut={refreshAuth} />
  ) : (
    <AuthFormRN onLoggedIn={refreshAuth} />
  );
}

/** ===== Styles ===== */
const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0f0f0fff",
  },
  err: { color: "#c00", fontWeight: "700", textAlign: "center" },

  // Auth
  authWrap: { gap: 16, backgroundColor: "#0f0f0fff", flex: 1 },
  authSwitchRow: { flexDirection: "row", paddingTop: 35 },
  switchBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 12,
    backgroundColor: "#2e2d2d",
    borderWidth: 1,
    borderColor: "#000",
  },
  switchBtnActive: { backgroundColor: "#8b0e0d" },
  switchText: { color: "#fff", fontWeight: "700" },
  form: { gap: 8, marginTop: 12, paddingHorizontal: 12 },
  label: { color: "#d0d0d0" },
  input: {
    backgroundColor: "#1a1919",
    borderWidth: 1,
    borderColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    color: "#fff",
  },

  // Buttons (shared)
  primaryBtn: {
    backgroundColor: "#570303",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginBottom: 8,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
    backgroundColor: "#434343",
  },
  secondaryBtnText: { color: "#e0e0e0", fontWeight: "700" },

  // Profile
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 20,
  },
  welcome: { color: "#fff", fontSize: 18, fontWeight: "800" },
  metaText: { color: "#d6d6d6", fontSize: 12, marginTop: 2 },
  sectionTitle: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 16,
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 6,
  },

  // Cards
  card: {
    flexDirection: "row",
    backgroundColor: "#191919",
    borderColor: "#151515",
    borderWidth: 2,
    borderRadius: 5,
    overflow: "hidden",
  },
  cardImg: { width: 96, height: 96, backgroundColor: "#333" },
  cardTitle: { color: "#dcd7d7", fontWeight: "800", fontSize: 14 },
  deleteBtn: {
    alignSelf: "center",
    paddingHorizontal: 12,
    paddingVertical: "10%",
    backgroundColor: "#750c0cff",
    borderRadius: 5,
  },
  modalOverlay: {
    flex: 1,
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#212121ff",
    borderRadius: 16,
    padding: 12,
    elevation: 4,
  },
  modalImg: {
    width: "100%",
    aspectRatio: 1.4,
    borderRadius: 12,
    backgroundColor: "#333",
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "800",
    marginTop: 10,
    color: "#dcd7d7ff",
  },
  section: {
    marginTop: 12,
    marginBottom: 4,
    fontWeight: "700",
    color: "#9b2929ff",
  },
  ingredient: {
    fontSize: 14,
    opacity: 0.9,
    marginVertical: 2,
    color: "#dcd7d7ff",
  },
});

import { useEffect, useState } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
} from "react-native";
import { API_BASE, fetchJSON } from "../../lib/api";

import { router } from "expo-router";

type Step = {
  type: "image" | "video" | "text";
  src?: string;
  description: string;
};
type Recipe = {
  _id?: string;
  id?: string;
  title: string;
  imgSrc: string;
  difficulty: "Beginner" | "Intermediate" | "Hard" | string;
  time: string;
  ingredients?: string[];
  steps?: Step[];
};

export default function HomeScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Recipe | null>(null);
  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const data = await fetchJSON<Recipe[]>(`${API_BASE}/api/recipes`);
        if (!aborted) setRecipes(data || []);
      } catch (e: any) {
        if (!aborted) setErr(e?.message || "Failed to load recipes.");
      } finally {
        if (!aborted) setLoading(false);
      }
    })();
    return () => {
      aborted = true;
    };
  }, []);

  if (!API_BASE) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>Missing EXPO_PUBLIC_API_BASE in .env</Text>
      </View>
    );
  }
  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 8 }}>Loading recipes…</Text>
      </View>
    );
  }
  if (err) {
    return (
      <View style={styles.center}>
        <Text style={styles.err}>Error: {err}</Text>
      </View>
    );
  }
  return (
    <View style={styles.container}>
      <Text style={styles.header}>🏠 Home</Text>
      <FlatList
        data={recipes}
        keyExtractor={(r) => String(r._id || r.id)}
        numColumns={2}
        columnWrapperStyle={{ gap: 12 }}
        contentContainerStyle={{ padding: 12 }}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        renderItem={({ item }) => (
          <Pressable style={styles.card} onPress={() => setSelected(item)}>
            <Image source={{ uri: item.imgSrc }} style={styles.img} />
            <Text style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Text style={styles.meta}>Difficulty: {item.difficulty}</Text>
            <Text style={styles.meta}>Time: {item.time} ⏱️</Text>
          </Pressable>
        )}
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
                  {selected!.ingredients!.map((ing, i) => (
                    <Text key={i} style={styles.ingredient}>
                      • {ing}
                    </Text>
                  ))}
                </>
              ) : null}
              <View style={{ height: 12 }} />
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
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  header: { fontSize: 22, fontWeight: "800", padding: 12 },
  card: {
    flex: 1,
    backgroundColor: "#fafafa",
    borderRadius: 12,
    padding: 10,
    gap: 6,
    elevation: 1,
  },
  img: {
    width: "100%",
    aspectRatio: 1.3,
    borderRadius: 10,
    backgroundColor: "#eee",
  },
  title: { fontSize: 14, fontWeight: "700" },
  meta: { fontSize: 12, opacity: 0.7 },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  err: { color: "#c00", fontWeight: "700", textAlign: "center" },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 16,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    elevation: 4,
  },
  modalImg: {
    width: "100%",
    aspectRatio: 1.4,
    borderRadius: 12,
    backgroundColor: "#eee",
  },
  modalTitle: { fontSize: 20, fontWeight: "800", marginTop: 10 },
  section: { marginTop: 12, marginBottom: 4, fontWeight: "700" },
  ingredient: { fontSize: 14, opacity: 0.9, marginVertical: 2 },
  primaryBtn: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 16,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
  },
  secondaryBtnText: { color: "#111", fontWeight: "700" },
});

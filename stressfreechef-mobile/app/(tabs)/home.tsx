import { useRef } from "react";
import { useScrollToTop } from "@react-navigation/native"; // ← tohle přidej

import {
  useFonts,
  Merienda_400Regular,
  Merienda_700Bold,
} from "@expo-google-fonts/merienda";
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
  ImageBackground,
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
  rating?: number;
  createdAt?: string;
};

export default function HomeScreen() {
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [selected, setSelected] = useState<Recipe | null>(null);

  const difficultyOrder = ["Beginner", "Intermediate", "Hard"];
  const [list, setList] = useState<Recipe[]>([]); // zobrazovaný seznam
  const [active, setActive] = useState<
    "EASIEST" | "NEWEST" | "FAVORITE" | "RANDOM"
  >("NEWEST");

  useEffect(() => {
    let aborted = false;
    (async () => {
      try {
        setLoading(true);
        setErr(null);
        const data = await fetchJSON<Recipe[]>(`${API_BASE}/api/recipes`);

        if (!aborted) {
          setRecipes(data || []);
          setList(
            (data || [])
              .slice()
              .sort(
                (a, b) =>
                  new Date(b.createdAt || 0).getTime() -
                  new Date(a.createdAt || 0).getTime()
              )
          ); // default NEWEST
        }
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

  function sortEasiest(src: Recipe[]) {
    return src
      .slice()
      .sort(
        (a, b) =>
          difficultyOrder.indexOf(a.difficulty || "") -
          difficultyOrder.indexOf(b.difficulty || "")
      );
  }
  function sortNewest(src: Recipe[]) {
    return src
      .slice()
      .sort(
        (a, b) =>
          new Date(b.createdAt || 0).getTime() -
          new Date(a.createdAt || 0).getTime()
      );
  }
  function sortFavorite(src: Recipe[]) {
    return src.slice().sort((a, b) => (b.rating || 0) - (a.rating || 0));
  }
  function shuffle(src: Recipe[]) {
    const arr = src.slice();
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }

  const listRef = useRef<FlatList<Recipe>>(null);
  useScrollToTop(listRef);

  const [fontsLoaded] = useFonts({
    Merienda_400Regular,
    Merienda_700Bold,
  });

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
      <FlatList
        ref={listRef}
        data={list}
        keyExtractor={(r) => String(r._id || r.id)}
        numColumns={2}
        columnWrapperStyle={{
          justifyContent: "space-between",
        }}
        ListHeaderComponent={
          <View>
            <View
              style={{
                alignItems: "center",
                flexDirection: "row",
              }}
            >
              <View
                style={{
                  alignItems: "center",
                  backgroundColor: "#760101",
                  height: 100,
                  width: "25%",

                  borderColor: "black",
                  borderWidth: 5,
                }}
              >
                <Image
                  style={{
                    flex: 0.8,
                    aspectRatio: 1.3,
                    justifyContent: "center",
                    top: 5,
                  }}
                  source={{ uri: "https://i.imgur.com/EdgU8NN.png" }}
                />
              </View>
              <Text
                style={{
                  width: "75%",
                  fontSize: 33,
                  lineHeight: 100,
                  borderWidth: 5,
                  borderLeftWidth: 0,
                  height: 100,
                  textAlign: "center",

                  backgroundColor: "#111111ff",
                  color: "#edededff",
                  fontFamily: "Merienda_400Regular",
                }}
              >
                Stress Free Chef
              </Text>
            </View>
            <View>
              <View style={{ flexDirection: "row" }}>
                <Pressable
                  style={[
                    styles.chip,
                    active === "NEWEST" && styles.chipActive,
                  ]}
                  onPress={() => {
                    setActive("NEWEST");
                    setList(sortNewest(recipes));
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active === "NEWEST" && styles.chipTextActive,
                    ]}
                  >
                    NEWEST
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chip,
                    active === "EASIEST" && styles.chipActive,
                  ]}
                  onPress={() => {
                    setActive("EASIEST");
                    setList(sortEasiest(recipes));
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active === "EASIEST" && styles.chipTextActive,
                    ]}
                  >
                    EASIEST
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    styles.chip,
                    active === "FAVORITE" && styles.chipActive,
                  ]}
                  onPress={() => {
                    setActive("FAVORITE");
                    setList(sortFavorite(recipes));
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active === "FAVORITE" && styles.chipTextActive,
                    ]}
                  >
                    FAVORITE
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.chip,
                    active === "RANDOM" && styles.chipActive,
                  ]}
                  onPress={() => {
                    setActive("RANDOM");
                    setList(shuffle(recipes));
                  }}
                >
                  <Text
                    style={[
                      styles.chipText,
                      active === "RANDOM" && styles.chipTextActive,
                    ]}
                  >
                    RANDOM
                  </Text>
                </Pressable>
              </View>
            </View>
          </View>
        }
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
  bg: { flex: 1 }, // ← layout pro ImageBackground
  bgImage: {
    resizeMode: "cover",
    opacity: 0.95, // ← vizuál bitmapy (bez flex!)
  },
  container: { flex: 1 }, // ← odstraněno bílé pozadí
  card: {
    flex: 1,
    backgroundColor: "#191919ff",
    borderColor: "#151515ff",
    borderWidth: 2,
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
  title: { fontSize: 14, fontWeight: "700", color: "#d0d0d0ff" },
  meta: { fontSize: 12, opacity: 0.7, color: "#d6d6d6ff" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
    backgroundColor: "#211d1dff",
  },
  err: { color: "#c00", fontWeight: "700", textAlign: "center" },

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
    backgroundColor: "#eee",
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
  primaryBtn: {
    backgroundColor: "#570303ff",
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
    backgroundColor: "#434343ff",
  },
  secondaryBtnText: { color: "#a8a3a3ff", fontWeight: "700" },

  chip: {
    paddingHorizontal: 15,
    paddingVertical: 15,
    flex: 1,
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: "#000000ff",
    backgroundColor: "#1a1919ff",
  },
  chipActive: {
    backgroundColor: "#660202ff",
    borderColor: "#570303ff",
  },
  chipText: {
    fontWeight: "700",
    color: "#d0d0d0",
    letterSpacing: 0.3,
  },
  chipTextActive: {
    color: "#ffffff",
  },
});

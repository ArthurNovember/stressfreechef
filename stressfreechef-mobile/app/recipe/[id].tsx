import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import { View, Text, Image, StyleSheet, Pressable } from "react-native";
import { Video, ResizeMode } from "expo-av";
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
  difficulty: string;
  time: string;
  steps?: Step[];
  image?: { url?: string };
};
export default function RecipeStepsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    id: string;
    recipe?: string; // JSON předaný z Home (dočasně)
  }>();
  // ⚠️ Dočasný zdroj dat ze stringu (rychlá integrace)
  let recipe: Recipe | null = null;
  try {
    recipe = params?.recipe ? JSON.parse(String(params.recipe)) : null;
  } catch {
    recipe = null;
  }

  const [current, setCurrent] = useState(0);
  const steps = recipe?.steps || [];
  if (!recipe || steps.length === 0) {
    return (
      <View style={s.center}>
        <Text style={s.err}>Recipe steps not available.</Text>
        <Pressable style={s.primary} onPress={() => router.back()}>
          <Text style={s.primaryText}>Back</Text>
        </Pressable>
      </View>
    );
  }
  const step = steps[current];
  return (
    <View style={s.wrapper}>
      {/* Obsah */}
      <View style={[s.card, { justifyContent: "space-between" }]}>
        <View>
          <Text style={s.title}>{recipe.title}</Text>
          <Text style={s.meta}>
            Step {current + 1} / {steps.length}
          </Text>

          {step.type === "image" && (
            <Image source={{ uri: step.src }} style={s.stepImg} />
          )}
          {step.type === "text" && (
            <View style={s.textStep}>
              <Text style={{ fontSize: 16 }}>{step.description}</Text>
            </View>
          )}
          {step.type === "video" && (
            <Video
              source={{ uri: step.src! }}
              style={s.stepImg}
              useNativeControls
              resizeMode={ResizeMode.CONTAIN}
              isLooping
            />
          )}

          <Text style={s.description}>{step.description}</Text>
        </View>
        <View style={s.row}>
          <Pressable
            disabled={current === 0}
            onPress={() => setCurrent((p) => Math.max(0, p - 1))}
            style={[s.btn, current === 0 && s.btnDisabled]}
          >
            <Text style={s.btnText}>PREVIOUS</Text>
          </Pressable>
          {current < steps.length - 1 ? (
            <Pressable
              onPress={() =>
                setCurrent((p) => Math.min(steps.length - 1, p + 1))
              }
              style={[s.btn, s.btnPrimary]}
            >
              <Text style={[s.btnText, { color: "#fff" }]}>NEXT STEP</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => router.back()}
              style={[s.btn, s.btnPrimary, { backgroundColor: "#410101ff" }]}
            >
              <Text style={[s.btnText, { color: "#fff" }]}>FINISH</Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}
const s = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#000" },

  card: {
    flex: 1,
    backgroundColor: "#211d1dff",
    padding: 16,
    paddingTop: 30,
  },
  title: { fontSize: 20, fontWeight: "800", color: "#dcd7d7ff" },
  meta: { opacity: 0.7, marginTop: 4, marginBottom: 8, color: "#dcd7d7ff" },
  stepImg: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: "#eee",
  },
  textStep: { padding: 12, borderRadius: 12, backgroundColor: "#fafafa" },
  description: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
    color: "#dcd7d7ff",
  },
  row: { flexDirection: "row", gap: 12, paddingBottom: 30 },
  btn: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ccc",
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.4 },
  btnPrimary: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  btnText: { fontWeight: "800", color: "#ffffffff" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  err: { color: "#c00", fontWeight: "700", marginBottom: 12 },
  primary: {
    backgroundColor: "#111",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  primaryText: { color: "#fff", fontWeight: "800" },
});

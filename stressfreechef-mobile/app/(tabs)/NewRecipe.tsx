import React, { useState } from "react";
import { useRouter } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImagePicker from "expo-image-picker";
import { API_BASE, fetchJSON } from "../../lib/api";

const BASE = API_BASE || "https://stressfreecheff-backend.onrender.com";
const TOKEN_KEY = "token";

async function getToken() {
  return (await AsyncStorage.getItem(TOKEN_KEY)) || "";
}

type LocalMediaType = "image" | "video";

type LocalStep = {
  description: string;
  timerInput: string; // "mm:ss" nebo "90"
  localUri?: string | null;
  mediaType?: LocalMediaType | null;
};

const DIFFICULTIES = ["Beginner", "Intermediate", "Hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

function parseTimerInput(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  // jen číslo => sekundy
  if (!value.includes(":")) {
    const sec = Number(value);
    if (!Number.isFinite(sec) || sec <= 0) return null;
    return Math.floor(sec);
  }

  // mm:ss
  const [mStr, sStr] = value.split(":");
  const min = Number(mStr);
  const sec = Number(sStr);
  if (
    !Number.isFinite(min) ||
    !Number.isFinite(sec) ||
    min < 0 ||
    sec < 0 ||
    sec >= 60
  ) {
    return null;
  }
  const total = min * 60 + sec;
  return total > 0 ? total : null;
}

async function pickMediaFromLibrary(): Promise<{
  uri: string;
  mediaType: LocalMediaType;
} | null> {
  const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (status !== "granted") {
    Alert.alert("Permission needed", "Allow access to photos and videos.");
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images", "videos"],
    quality: 1,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const mediaType: LocalMediaType = asset.type === "video" ? "video" : "image";

  return {
    uri: asset.uri,
    mediaType,
  };
}

async function uploadRecipeMediaMobile(
  token: string,
  recipeId: string,
  uri: string
) {
  const formData = new FormData();
  formData.append("recipeId", recipeId);

  const fileName = uri.split("/").pop() || "recipe-media";
  const ext = fileName.split(".").pop()?.toLowerCase();
  const isVideo =
    ext && ["mp4", "mov", "avi", "mkv", "webm"].includes(ext as string);

  formData.append("file", {
    uri,
    name: fileName,
    type: isVideo ? "video/mp4" : "image/jpeg",
  } as any);

  const res = await fetch(`${BASE}/api/uploads/recipe-media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }
}

async function uploadStepMediaMobile(
  token: string,
  recipeId: string,
  stepIndex: number,
  uri: string,
  mediaType: LocalMediaType
) {
  const formData = new FormData();
  formData.append("recipeId", recipeId);
  formData.append("stepIndex", String(stepIndex));

  const fileName = uri.split("/").pop() || `step-${stepIndex}`;
  formData.append("file", {
    uri,
    name: fileName,
    type: mediaType === "video" ? "video/mp4" : "image/jpeg",
  } as any);

  const res = await fetch(`${BASE}/api/uploads/recipe-step-media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await res.text());
  }
}

async function publishRecipeMobile(token: string, recipeId: string) {
  const res = await fetch(`${BASE}/api/my-recipes/${recipeId}`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ isPublic: true }),
  });
  if (!res.ok) {
    throw new Error(await res.text());
  }
}

export default function NewRecipeScreen() {
  const router = useRouter();

  // hlavní info
  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Beginner");
  const [time, setTime] = useState(""); // např. "00:20" nebo "20 min"

  const [isPublic, setIsPublic] = useState(false);

  // thumbnail
  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [thumbMediaType, setThumbMediaType] = useState<LocalMediaType>("image");

  // kroky
  const [steps, setSteps] = useState<LocalStep[]>([
    { description: "", timerInput: "", localUri: null, mediaType: null },
  ]);

  // ingredience
  const [ingredients, setIngredients] = useState<string[]>([""]);

  // UI stav
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handlePickThumb = async () => {
    const picked = await pickMediaFromLibrary();
    if (!picked) return;
    setThumbUri(picked.uri);
    setThumbMediaType(picked.mediaType);
  };

  const handlePickStepMedia = async (index: number) => {
    const picked = await pickMediaFromLibrary();
    if (!picked) return;

    setSteps((prev) =>
      prev.map((s, i) =>
        i === index
          ? {
              ...s,
              localUri: picked.uri,
              mediaType: picked.mediaType,
            }
          : s
      )
    );
  };

  const updateStepDesc = (index: number, value: string) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, description: value } : s))
    );
  };

  const updateStepTimer = (index: number, value: string) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, timerInput: value } : s))
    );
  };

  const addStep = () => {
    setSteps((prev) => [
      ...prev,
      { description: "", timerInput: "", localUri: null, mediaType: null },
    ]);
  };

  const removeStep = (index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  };

  const updateIngredient = (index: number, value: string) => {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? value : ing)));
  };

  const addIngredient = () => {
    setIngredients((prev) => [...prev, ""]);
  };

  const removeIngredient = (index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async () => {
    try {
      setErr(null);
      setSuccessMsg(null);

      if (!title.trim() || !difficulty || !time.trim()) {
        setErr("Fill in Title, Difficulty and Time.");
        return;
      }

      const hasTextStep = steps.some(
        (s) => (s.description || "").trim().length > 0
      );
      if (!hasTextStep) {
        setErr("Add at least one step description.");
        return;
      }

      // validace timerů
      for (let i = 0; i < steps.length; i++) {
        const raw = steps[i].timerInput.trim();
        if (!raw) continue;
        const seconds = parseTimerInput(raw);
        if (!seconds) {
          setErr(
            `Step ${
              i + 1
            }: Timer must be in format "mm:ss" or a number of seconds.`
          );
          return;
        }
      }

      setSaving(true);

      const token = await getToken();
      if (!token) {
        Alert.alert("Not logged in", "Log in on MyProfile first.");
        return;
      }

      // kroky do payloadu – stejně jako web + navíc timerSeconds
      const payloadSteps = steps
        .map((s) => {
          const description = (s.description || "").trim();
          const base: any = {
            type: "text",
            description,
          };

          const rawTimer = s.timerInput.trim();
          const seconds = rawTimer ? parseTimerInput(rawTimer) : null;
          if (seconds && seconds > 0) {
            base.timerSeconds = seconds;
          }

          return base;
        })
        .filter((s) => s.description);

      const payload = {
        title: title.trim(),
        difficulty,
        time: time.trim(),
        imgSrc: undefined,
        ingredients: ingredients
          .map((ing) => (ing || "").trim())
          .filter(Boolean),
        steps: payloadSteps,
        isPublic: false, // stejně jako web – public až po uploadech
      };

      // 1) vytvoř my-recipe
      const created = await fetchJSON<any>(`${BASE}/api/my-recipes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const recipeId = created._id as string;

      // 2) thumbnail
      if (thumbUri) {
        await uploadRecipeMediaMobile(token, recipeId, thumbUri);
      }

      // 3) media ke krokům – indexy držíme stejné jako na webu
      await Promise.all(
        steps.map(async (s, index) => {
          if (s.localUri && s.mediaType) {
            await uploadStepMediaMobile(
              token,
              recipeId,
              index,
              s.localUri,
              s.mediaType
            );
          }
        })
      );

      // 4) publish (pokud je zvoleno Public)
      if (isPublic) {
        await publishRecipeMobile(token, recipeId);
      }

      setSuccessMsg(`Recipe created${isPublic ? " and shared publicly" : ""}.`);

      // reset formuláře
      setTitle("");
      setDifficulty("Beginner");
      setTime("");
      setIsPublic(false);
      setThumbUri(null);
      setSteps([
        { description: "", timerInput: "", localUri: null, mediaType: null },
      ]);
      setIngredients([""]);
    } catch (e: any) {
      setErr(e?.message || "Save failed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {err && <Text style={styles.error}>{err}</Text>}
      {successMsg && <Text style={styles.success}>{successMsg}</Text>}

      {/* Hlavní info */}
      <View style={styles.card}>
        <Text style={styles.label}>Name of the Recipe</Text>
        <TextInput
          style={styles.input}
          placeholder="Title"
          placeholderTextColor="#999"
          value={title}
          onChangeText={setTitle}
        />

        <Text style={styles.label}>Difficulty</Text>
        <View style={styles.difficultyRow}>
          {DIFFICULTIES.map((d) => {
            const active = d === difficulty;
            return (
              <Pressable
                key={d}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setDifficulty(d)}
              >
                <Text
                  style={[styles.chipText, active && styles.chipTextActive]}
                >
                  {d}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Time</Text>
        <TextInput
          style={styles.input}
          placeholder='e.g. "00:20" or "20 min"'
          placeholderTextColor="#999"
          value={time}
          onChangeText={setTime}
        />

        <View style={styles.publicRow}>
          <Text style={styles.label}>Public</Text>
          <Switch value={isPublic} onValueChange={setIsPublic} />
        </View>
      </View>

      {/* Thumbnail */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Recipe Thumbnail</Text>
        <Pressable style={styles.thumbBox} onPress={handlePickThumb}>
          {thumbUri ? (
            thumbMediaType === "image" ? (
              <Image source={{ uri: thumbUri }} style={styles.thumbImage} />
            ) : (
              <Text style={styles.thumbPlaceholder}>
                Video selected (thumbnail)
              </Text>
            )
          ) : (
            <Text style={styles.thumbPlaceholder}>
              Tap to select image or video
            </Text>
          )}
        </Pressable>
      </View>

      {/* Steps */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Steps</Text>
        {steps.map((step, index) => (
          <View key={index} style={styles.stepCard}>
            <View style={styles.stepHeaderRow}>
              <Text style={styles.stepTitle}>Step {index + 1}</Text>
              {steps.length > 1 && (
                <Pressable
                  onPress={() => removeStep(index)}
                  style={styles.removeBtn}
                >
                  <Text style={styles.removeBtnText}>X</Text>
                </Pressable>
              )}
            </View>

            <TextInput
              style={[styles.input, styles.multilineInput]}
              placeholder="Describe the step…"
              placeholderTextColor="#999"
              multiline
              value={step.description}
              onChangeText={(val) => updateStepDesc(index, val)}
            />

            <Pressable
              style={styles.stepMediaBox}
              onPress={() => handlePickStepMedia(index)}
            >
              {step.localUri ? (
                step.mediaType === "image" ? (
                  <Image
                    source={{ uri: step.localUri }}
                    style={styles.stepImage}
                  />
                ) : (
                  <Text style={styles.thumbPlaceholder}>Video selected</Text>
                )
              ) : (
                <Text style={styles.thumbPlaceholder}>
                  Tap to select step image / video
                </Text>
              )}
            </Pressable>

            <View style={styles.timerRow}>
              <Text style={styles.timerLabel}>
                Timer (optional, mm:ss or seconds)
              </Text>
              <TextInput
                style={styles.timerInput}
                placeholder="e.g. 30 or 00:30"
                placeholderTextColor="#999"
                value={step.timerInput}
                onChangeText={(val) => updateStepTimer(index, val)}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          </View>
        ))}

        <Pressable style={styles.addBtn} onPress={addStep}>
          <Text style={styles.addBtnText}>+ Add Step</Text>
        </Pressable>
      </View>

      {/* Ingredients */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Ingredients</Text>
        {ingredients.map((ing, index) => (
          <View key={index} style={styles.ingredientRow}>
            <TextInput
              style={[styles.input, styles.ingredientInput]}
              placeholder="e.g. chicken breast"
              placeholderTextColor="#999"
              value={ing}
              onChangeText={(val) => updateIngredient(index, val)}
            />
            {ingredients.length > 1 && (
              <Pressable
                style={styles.removeBtn}
                onPress={() => removeIngredient(index)}
              >
                <Text style={styles.removeBtnText}>X</Text>
              </Pressable>
            )}
          </View>
        ))}
        <Pressable style={styles.addBtn} onPress={addIngredient}>
          <Text style={styles.addBtnText}>+ Add Ingredient</Text>
        </Pressable>
      </View>

      {/* Submit */}
      <Pressable
        style={[styles.submitBtn, saving && styles.submitBtnDisabled]}
        onPress={saving ? undefined : handleSubmit}
      >
        {saving ? (
          <ActivityIndicator />
        ) : (
          <Text style={styles.submitBtnText}>Create Recipe</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
    backgroundColor: "#0f0f0fff",
    paddingTop: 40,
  },
  card: {
    backgroundColor: "#181818",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#333",
  },
  label: {
    color: "#ccc",
    marginBottom: 4,
    fontSize: 14,
  },
  input: {
    backgroundColor: "#222",
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#444",
    marginBottom: 12,
    fontSize: 14,
  },
  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  sectionTitle: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },
  difficultyRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#555",
  },
  chipActive: {
    backgroundColor: "#680e16ff",
    borderColor: "#680e16ff",
  },
  chipText: {
    color: "#ccc",
    fontSize: 13,
  },
  chipTextActive: {
    color: "#fff",
  },
  publicRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 4,
  },
  thumbBox: {
    marginTop: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#444",
    backgroundColor: "#222",
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 140,
  },
  thumbImage: {
    width: "100%",
    height: 180,
    borderRadius: 12,
  },
  thumbPlaceholder: {
    color: "#777",
    fontSize: 13,
    textAlign: "center",
  },
  stepCard: {
    backgroundColor: "#222",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#444",
  },
  stepHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  stepTitle: {
    color: "#fff",
    fontWeight: "500",
  },
  stepMediaBox: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#444",
    backgroundColor: "#1b1b1b",
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
    marginBottom: 10,
  },
  stepImage: {
    width: "100%",
    height: 160,
    borderRadius: 8,
  },
  timerRow: {
    marginTop: 4,
  },
  timerLabel: {
    color: "#aaa",
    fontSize: 12,
    marginBottom: 4,
  },
  timerInput: {
    backgroundColor: "#222",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#444",
    fontSize: 13,
  },
  ingredientRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  ingredientInput: {
    flex: 1,
    marginBottom: 0,
  },
  addBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#555",
    alignItems: "center",
  },
  addBtnText: {
    color: "#eee",
    fontSize: 14,
    fontWeight: "500",
  },
  submitBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 999,
    backgroundColor: "#e63946",
    alignItems: "center",
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "#333",
  },
  removeBtnText: {
    color: "#ff7676",
    fontWeight: "600",
    fontSize: 12,
  },
  error: {
    color: "#ff7676",
    marginBottom: 4,
  },
  success: {
    color: "#7cd992",
    marginBottom: 4,
  },
});

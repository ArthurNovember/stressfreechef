import React, { useState, useEffect } from "react";
import { t, Lang, LANG_KEY } from "../../i18n/strings";
import { useTheme } from "../../theme/ThemeContext";
import DateTimePicker from "@react-native-community/datetimepicker";

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

  const parts = value.split(":");

  // jen číslo => sekundy
  if (parts.length === 1) {
    const sec = Number(parts[0]);
    if (!Number.isFinite(sec) || sec <= 0) return null;
    return Math.floor(sec);
  }

  // mm:ss
  if (parts.length === 2) {
    const [mStr, sStr] = parts;
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

  // hh:mm:ss
  if (parts.length === 3) {
    const [hStr, mStr, sStr] = parts;
    const h = Number(hStr);
    const m = Number(mStr);
    const s = Number(sStr);
    if (
      !Number.isFinite(h) ||
      !Number.isFinite(m) ||
      !Number.isFinite(s) ||
      h < 0 ||
      m < 0 ||
      m >= 60 ||
      s < 0 ||
      s >= 60
    ) {
      return null;
    }
    const total = h * 3600 + m * 60 + s;
    return total > 0 ? total : null;
  }

  return null;
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

function clampInt(raw: string, max: number): number {
  const cleaned = raw.replace(/\D/g, ""); // jen čísla
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

function splitTimerHMS(timer: string) {
  let h = 0;
  let m = 0;
  let s = 0;

  const parts = timer.split(":").filter(Boolean);

  if (parts.length === 1) {
    const sec = Number(parts[0]);
    if (Number.isFinite(sec) && sec > 0) {
      h = Math.floor(sec / 3600);
      const rem = sec % 3600;
      m = Math.floor(rem / 60);
      s = rem % 60;
    }
  } else if (parts.length === 2) {
    m = clampInt(parts[0], 59);
    s = clampInt(parts[1], 59);
  } else if (parts.length >= 3) {
    h = clampInt(parts[0], 99);
    m = clampInt(parts[1], 59);
    s = clampInt(parts[2], 59);
  }

  return {
    h: String(h).padStart(2, "0"),
    m: String(m).padStart(2, "0"),
    s: String(s).padStart(2, "0"),
  };
}

function convertRecipeTimeToDate(time: string): Date {
  const d = new Date(0);
  if (!time) return d;

  const parts = time.split(":");
  const h = Number(parts[0] ?? 0);
  const m = Number(parts[1] ?? 0);

  d.setHours(Number.isFinite(h) ? h : 0);
  d.setMinutes(Number.isFinite(m) ? m : 0);
  d.setSeconds(0);

  return d;
}

export default function NewRecipeScreen() {
  const router = useRouter();
  const { colors } = useTheme(); // 🎨 sem si sáhneš na barvy
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

  const [lang, setLang] = useState<Lang>("en");
  const [showTimePicker, setShowTimePicker] = useState(false);

  function handleRecipeTimeChange(date: Date | undefined) {
    if (!date) {
      setShowTimePicker(false);
      return;
    }

    const h = date.getHours();
    const m = date.getMinutes();

    const formatted = `${String(h).padStart(2, "0")}:${String(m).padStart(
      2,
      "0"
    )}`;

    setTime(formatted);
    setShowTimePicker(false);
  }

  function updateStepTimerPart(
    index: number,
    part: "h" | "m" | "s",
    raw: string
  ) {
    setSteps((prev) =>
      prev.map((step, i) => {
        if (i !== index) return step;

        const current = splitTimerHMS(step.timerInput);
        const max = part === "h" ? 99 : 59;
        const n = clampInt(raw, max);

        const nextH = part === "h" ? n : Number(current.h);
        const nextM = part === "m" ? n : Number(current.m);
        const nextS = part === "s" ? n : Number(current.s);

        const formatted = `${String(nextH).padStart(2, "0")}:${String(
          nextM
        ).padStart(2, "0")}:${String(nextS).padStart(2, "0")}`;

        return { ...step, timerInput: formatted };
      })
    );
  }

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(LANG_KEY);
      if (stored === "cs" || stored === "en") setLang(stored);
    })();
  }, []);

  function translateDifficulty(lang: Lang, diff: string) {
    if (lang === "cs") {
      if (diff === "Beginner") return "Začátečník";
      if (diff === "Intermediate") return "Pokročílý";
      if (diff === "Hard") return "Expert";
    }
    return diff;
  }

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
        setErr(t(lang, "newRecipe", "errorFillMainFields"));
        return;
      }

      const hasTextStep = steps.some(
        (s) => (s.description || "").trim().length > 0
      );
      if (!hasTextStep) {
        setErr(t(lang, "newRecipe", "errorNoStep"));
        return;
      }

      // validace timerů
      for (let i = 0; i < steps.length; i++) {
        const raw = steps[i].timerInput.trim();
        if (!raw) continue;
        const seconds = parseTimerInput(raw);
        if (!seconds) {
          // ❌ nevalidní timer → ukončit
          setErr(
            lang === "cs"
              ? `Krok ${
                  i + 1
                }: Časovač musí být ve formátu "mm:ss" nebo jako počet sekund.`
              : `Step ${
                  i + 1
                }: Timer must be in format "mm:ss" or a number of seconds.`
          );
          return;
        }
      }

      setSaving(true);

      const token = await getToken();
      if (!token) {
        Alert.alert(
          t(lang, "newRecipe", "notLoggedInTitle"),
          t(lang, "newRecipe", "notLoggedInMsg")
        );
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

      setSuccessMsg(
        lang === "cs"
          ? isPublic
            ? t(lang, "newRecipe", "recipeCreatedPublic")
            : t(lang, "newRecipe", "recipeCreated")
          : isPublic
          ? t(lang, "newRecipe", "recipeCreatedPublic")
          : t(lang, "newRecipe", "recipeCreated")
      );

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
      setErr(e?.message || t(lang, "newRecipe", "saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={[
        styles.container,
        { backgroundColor: colors.background },
      ]}
    >
      {err && (
        <Text style={[styles.error, { color: colors.danger }]}>{err}</Text>
      )}
      {successMsg && (
        <Text style={[styles.success, { color: "#7cd992" }]}>{successMsg}</Text>
      )}

      {/* Hlavní info */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.label, { color: colors.text }]}>
          {t(lang, "newRecipe", "nameLabel")}
        </Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.card,
              borderColor: colors.border,
              color: colors.text,
            },
          ]}
          placeholder={t(lang, "newRecipe", "titlePlaceholder")}
          placeholderTextColor={colors.muted}
          value={title}
          onChangeText={setTitle}
        />

        <Text style={[styles.label, { color: colors.text }]}>
          {t(lang, "newRecipe", "difficultyLabel")}
        </Text>
        <View style={styles.difficultyRow}>
          {DIFFICULTIES.map((d) => {
            const active = d === difficulty;
            return (
              <Pressable
                key={d}
                style={[
                  styles.chip,
                  {
                    backgroundColor: colors.card,
                    borderColor: colors.border,
                  },
                  active && {
                    backgroundColor: colors.pillActive,
                    borderColor: colors.pillActive,
                  },
                ]}
                onPress={() => setDifficulty(d)}
              >
                <Text
                  style={[
                    styles.chipText,
                    { color: colors.text },
                    active && styles.chipTextActive,
                  ]}
                >
                  {translateDifficulty(lang, d)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={[styles.label, { color: colors.text }]}>
          {" "}
          {t(lang, "newRecipe", "timeLabel")}
        </Text>
        <Pressable
          onPress={() => setShowTimePicker(true)}
          style={[
            styles.input,
            {
              justifyContent: "center",
              backgroundColor: colors.card,
              borderColor: colors.border,
            },
          ]}
        >
          <Text
            style={{
              color: time ? colors.text : colors.muted,
              fontSize: 14,
            }}
          >
            {time ||
              (lang === "cs" ? "Vyber čas (HH:MM)" : "Select time (HH:MM)")}
          </Text>
        </Pressable>

        {showTimePicker && (
          <DateTimePicker
            mode="time"
            display="spinner"
            value={convertRecipeTimeToDate(time)}
            onChange={(_, date) => handleRecipeTimeChange(date || undefined)}
          />
        )}

        <View style={styles.publicRow}>
          <Text style={[styles.label, { color: colors.text }]}>
            {" "}
            {t(lang, "newRecipe", "publicLabel")}
          </Text>
          <Switch value={isPublic} onValueChange={setIsPublic} />
        </View>
      </View>

      {/* Thumbnail */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {" "}
          {t(lang, "newRecipe", "thumbTitle")}
        </Text>
        <Pressable
          style={[
            styles.thumbBox,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={handlePickThumb}
        >
          {thumbUri ? (
            thumbMediaType === "image" ? (
              <Image source={{ uri: thumbUri }} style={styles.thumbImage} />
            ) : (
              <Text style={[styles.thumbPlaceholder, { color: colors.muted }]}>
                {t(lang, "newRecipe", "thumbVideoSelected")}
              </Text>
            )
          ) : (
            <Text style={[styles.thumbPlaceholder, { color: colors.muted }]}>
              {t(lang, "newRecipe", "thumbTapSelect")}
            </Text>
          )}
        </Pressable>
      </View>

      {/* Steps */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={styles.sectionTitle}>
          {" "}
          {t(lang, "newRecipe", "stepsTitle")}
        </Text>
        {steps.map((step, index) => (
          <View
            key={index}
            style={[
              styles.stepCard,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={styles.stepHeaderRow}>
              <Text style={[styles.stepTitle, { color: colors.text }]}>
                {" "}
                {t(lang, "newRecipe", "stepLabelPrefix")} {index + 1}
              </Text>
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
              style={[
                styles.input,
                styles.multilineInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholderTextColor={colors.muted}
              placeholder={t(lang, "newRecipe", "stepDescribePlaceholder")}
              multiline
              value={step.description}
              onChangeText={(val) => updateStepDesc(index, val)}
            />

            <Pressable
              style={[
                styles.stepMediaBox,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
              onPress={() => handlePickStepMedia(index)}
            >
              {step.localUri ? (
                step.mediaType === "image" ? (
                  <Image
                    source={{ uri: step.localUri }}
                    style={styles.stepImage}
                  />
                ) : (
                  <Text
                    style={[styles.thumbPlaceholder, { color: colors.muted }]}
                  >
                    {" "}
                    {t(lang, "newRecipe", "stepVideoSelected")}
                  </Text>
                )
              ) : (
                <Text
                  style={[styles.thumbPlaceholder, { color: colors.muted }]}
                >
                  {t(lang, "newRecipe", "stepMediaPlaceholder")}
                </Text>
              )}
            </Pressable>

            <View style={styles.timerRow}>
              <Text
                style={[styles.timerLabel, { color: colors.secondaryText }]}
              >
                {lang === "cs"
                  ? "Časovač (volitelné, HH:MM:SS)"
                  : "Timer (optional, HH:MM:SS)"}
              </Text>

              {(() => {
                const { h, m, s } = splitTimerHMS(step.timerInput);
                return (
                  <View style={styles.timerHmsRow}>
                    <View style={styles.timerField}>
                      <Text style={styles.timerFieldLabel}>h</Text>
                      <TextInput
                        style={[
                          styles.timerFieldInput,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        keyboardType="number-pad"
                        value={h}
                        onChangeText={(val) =>
                          updateStepTimerPart(index, "h", val)
                        }
                        placeholder="00"
                        placeholderTextColor={colors.muted}
                      />
                    </View>

                    <View style={styles.timerField}>
                      <Text style={styles.timerFieldLabel}>m</Text>
                      <TextInput
                        style={[
                          styles.timerFieldInput,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        keyboardType="number-pad"
                        value={m}
                        onChangeText={(val) =>
                          updateStepTimerPart(index, "m", val)
                        }
                        placeholder="00"
                        placeholderTextColor={colors.muted}
                      />
                    </View>

                    <View style={styles.timerField}>
                      <Text style={styles.timerFieldLabel}>s</Text>
                      <TextInput
                        style={[
                          styles.timerFieldInput,
                          {
                            backgroundColor: colors.card,
                            borderColor: colors.border,
                            color: colors.text,
                          },
                        ]}
                        keyboardType="number-pad"
                        value={s}
                        onChangeText={(val) =>
                          updateStepTimerPart(index, "s", val)
                        }
                        placeholder="00"
                        placeholderTextColor={colors.muted}
                      />
                    </View>
                  </View>
                );
              })()}
            </View>
          </View>
        ))}

        <Pressable style={styles.addBtn} onPress={addStep}>
          <Text style={[styles.addBtnText, { color: colors.text }]}>
            {" "}
            {t(lang, "newRecipe", "addStepBtn")}
          </Text>
        </Pressable>
      </View>

      {/* Ingredients */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={styles.sectionTitle}>
          {" "}
          {t(lang, "newRecipe", "ingredientsTitle")}
        </Text>
        {ingredients.map((ing, index) => (
          <View key={index} style={styles.ingredientRow}>
            <TextInput
              style={[
                styles.input,
                styles.ingredientInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              placeholderTextColor={colors.muted}
              placeholder={t(lang, "newRecipe", "ingredientPlaceholder")}
              value={ing}
              onChangeText={(val) => updateIngredient(index, val)}
            />
            {ingredients.length > 1 && (
              <Pressable
                style={[styles.removeBtn, { backgroundColor: colors.card }]}
                onPress={() => removeIngredient(index)}
              >
                <Text style={[styles.removeBtnText, { color: colors.danger }]}>
                  X
                </Text>
              </Pressable>
            )}
          </View>
        ))}
        <Pressable
          style={[styles.addBtn, { borderColor: colors.border }]}
          onPress={addIngredient}
        >
          <Text style={[styles.addBtnText, { color: colors.text }]}>
            {t(lang, "newRecipe", "addIngredientBtn")}
          </Text>
        </Pressable>
      </View>

      {/* Submit */}
      <Pressable
        style={[
          styles.submitBtn,
          {
            backgroundColor: colors.pillActive,
          },
          saving && styles.submitBtnDisabled,
        ]}
        onPress={saving ? undefined : handleSubmit}
      >
        {saving ? (
          <ActivityIndicator />
        ) : (
          <Text style={[styles.submitBtnText, { color: colors.text }]}>
            {t(lang, "newRecipe", "createBtn")}
          </Text>
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
  timerHmsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  timerField: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  timerFieldLabel: {
    color: "#aaa",
    fontSize: 12,
  },
  timerFieldInput: {
    minWidth: 50,
    textAlign: "center",
    backgroundColor: "#222",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    color: "#fff",
    borderWidth: 1,
    borderColor: "#444",
    fontSize: 13,
  },
});

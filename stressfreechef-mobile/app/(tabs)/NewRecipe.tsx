import React, { useEffect, useMemo, useState, useCallback } from "react";
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

import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Clipboard from "expo-clipboard";
import * as ImagePicker from "expo-image-picker";

import { t, Lang, LANG_KEY } from "../../i18n/strings";
import { useTheme } from "../../theme/ThemeContext";
import { API_BASE, fetchJSON } from "../../lib/api";

/* =========================
   TYPES
========================= */

type LocalMediaType = "image" | "video";

type LocalStep = {
  description: string;
  timerInput: string;
  localUri?: string | null;
  mediaType?: LocalMediaType | null;
};

const DIFFICULTIES = ["Beginner", "Intermediate", "Hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

type AiStepInput = {
  description: string;
  timerSeconds?: number;
};

type AiRecipeInput = {
  title: string;
  difficulty?: Difficulty;
  time: string;
  ingredients: string[];
  steps: AiStepInput[];
};

type ActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

/* =========================
   CONSTS
========================= */

const BASE = API_BASE || "https://stressfreecheff-backend.onrender.com";
const TOKEN_KEY = "token";

/* =========================
   HELPERS 
========================= */

function translateDifficulty(lang: Lang, diff: string) {
  if (lang === "cs") {
    if (diff === "Beginner") return "Začátečník";
    if (diff === "Intermediate") return "Pokročilý";
    if (diff === "Hard") return "Expert";
  }
  return diff;
}

function secondsToHmsInput(total: number | undefined | null): string {
  if (!Number.isFinite(Number(total)) || !total || total <= 0) return "";
  const t = Number(total);
  const h = Math.floor(t / 3600);
  const rem = t % 3600;
  const m = Math.floor(rem / 60);
  const s = rem % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(
    s
  ).padStart(2, "0")}`;
}

function clampInt(raw: string, max: number): number {
  const cleaned = raw.replace(/\D/g, "");
  if (!cleaned) return 0;
  const n = Number(cleaned);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, max);
}

function splitTimerHMS(timer: string) {
  let h = 0;
  let m = 0;
  let s = 0;

  const parts = String(timer || "")
    .split(":")
    .filter(Boolean);

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

function parseTimerInput(raw: string): number | null {
  const value = raw.trim();
  if (!value) return null;

  const parts = value.split(":");

  if (parts.length === 1) {
    const sec = Number(parts[0]);
    if (!Number.isFinite(sec) || sec <= 0) return null;
    return Math.floor(sec);
  }

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

/* =========================
  API
========================= */

async function getToken(): Promise<string> {
  return (await AsyncStorage.getItem(TOKEN_KEY)) || "";
}

async function loadLang(): Promise<Lang> {
  try {
    const stored = await AsyncStorage.getItem(LANG_KEY);
    return stored === "cs" || stored === "en" ? stored : "en";
  } catch {
    return "en";
  }
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

  return { uri: asset.uri, mediaType };
}

async function uploadRecipeMediaMobile(
  token: string,
  recipeId: string,
  uri: string
): Promise<ActionResult<true>> {
  try {
    const formData = new FormData();
    formData.append("recipeId", recipeId);

    const fileName = uri.split("/").pop() || "recipe-media";
    const ext = fileName.split(".").pop()?.toLowerCase();
    const isVideo = !!(
      ext && ["mp4", "mov", "avi", "mkv", "webm"].includes(ext)
    );

    formData.append("file", {
      uri,
      name: fileName,
      type: isVideo ? "video/mp4" : "image/jpeg",
    } as any);

    const res = await fetch(`${BASE}/api/uploads/recipe-media`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) return { ok: false, error: await res.text() };

    return { ok: true, data: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Upload failed." };
  }
}

async function uploadStepMediaMobile(
  token: string,
  recipeId: string,
  stepIndex: number,
  uri: string,
  mediaType: LocalMediaType
): Promise<ActionResult<true>> {
  try {
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
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });

    if (!res.ok) return { ok: false, error: await res.text() };

    return { ok: true, data: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Upload failed." };
  }
}

async function publishRecipeMobile(
  token: string,
  recipeId: string
): Promise<ActionResult<true>> {
  try {
    const res = await fetch(`${BASE}/api/my-recipes/${recipeId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ isPublic: true }),
    });

    if (!res.ok) return { ok: false, error: await res.text() };
    return { ok: true, data: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Publish failed." };
  }
}

/* =========================
   AI 
========================= */

function validateAiRecipeInput(
  lang: Lang,
  parsed: any
): ActionResult<AiRecipeInput> {
  if (!parsed || typeof parsed !== "object") {
    return {
      ok: false,
      error:
        lang === "cs"
          ? "Očekávám JSON objekt s vlastnostmi title, time, ingredients a steps."
          : "Expected a JSON object with title, time, ingredients and steps.",
    };
  }

  if (!parsed.title || typeof parsed.title !== "string") {
    return {
      ok: false,
      error: lang === "cs" ? "Chybí title." : "Missing title.",
    };
  }

  if (!parsed.time || typeof parsed.time !== "string") {
    return {
      ok: false,
      error: lang === "cs" ? "Chybí time (HH:MM)." : "Missing time (HH:MM).",
    };
  }

  if (!Array.isArray(parsed.ingredients) || parsed.ingredients.length === 0) {
    return {
      ok: false,
      error:
        lang === "cs"
          ? "Chybí ingredients (alespoň jedna ingredience)."
          : "Missing ingredients (at least one item).",
    };
  }

  if (!Array.isArray(parsed.steps) || parsed.steps.length === 0) {
    return {
      ok: false,
      error:
        lang === "cs"
          ? "Chybí steps (alespoň jeden krok s description)."
          : "Missing steps (at least one step with description).",
    };
  }

  return { ok: true, data: parsed as AiRecipeInput };
}

/* =========================
   SCREEN
========================= */

export default function NewRecipeScreen() {
  const router = useRouter();
  const { colors } = useTheme();

  const [title, setTitle] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("Beginner");
  const [time, setTime] = useState(""); // "HH:MM"
  const [isPublic, setIsPublic] = useState(false);

  const [thumbUri, setThumbUri] = useState<string | null>(null);
  const [thumbMediaType, setThumbMediaType] = useState<LocalMediaType>("image");

  const [steps, setSteps] = useState<LocalStep[]>([
    { description: "", timerInput: "", localUri: null, mediaType: null },
  ]);
  const [ingredients, setIngredients] = useState<string[]>([""]);

  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [lang, setLang] = useState<Lang>("en");
  const [showTimePicker, setShowTimePicker] = useState(false);

  const [aiMode, setAiMode] = useState(false);
  const [aiText, setAiText] = useState("");
  const [aiImportErr, setAiImportErr] = useState<string | null>(null);

  useEffect(() => {
    (async () => setLang(await loadLang()))();
  }, []);

  const timePickerDate = useMemo(() => convertRecipeTimeToDate(time), [time]);

  /* =========================
     HANDLERS
  ========================= */

  const handlePickThumb = useCallback(async () => {
    const picked = await pickMediaFromLibrary();
    if (!picked) return;
    setThumbUri(picked.uri);
    setThumbMediaType(picked.mediaType);
  }, []);

  const handlePickStepMedia = useCallback(async (index: number) => {
    const picked = await pickMediaFromLibrary();
    if (!picked) return;

    setSteps((prev) =>
      prev.map((s, i) =>
        i === index
          ? { ...s, localUri: picked.uri, mediaType: picked.mediaType }
          : s
      )
    );
  }, []);

  const updateStepDesc = useCallback((index: number, value: string) => {
    setSteps((prev) =>
      prev.map((s, i) => (i === index ? { ...s, description: value } : s))
    );
  }, []);

  const addStep = useCallback(() => {
    setSteps((prev) => [
      ...prev,
      { description: "", timerInput: "", localUri: null, mediaType: null },
    ]);
  }, []);

  const removeStep = useCallback((index: number) => {
    setSteps((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const updateIngredient = useCallback((index: number, value: string) => {
    setIngredients((prev) => prev.map((ing, i) => (i === index ? value : ing)));
  }, []);

  const addIngredient = useCallback(() => {
    setIngredients((prev) => [...prev, ""]);
  }, []);

  const removeIngredient = useCallback((index: number) => {
    setIngredients((prev) => prev.filter((_, i) => i !== index));
  }, []);

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

  const handleCopyAiPrompt = useCallback(async () => {
    const prompt =
      lang === "cs"
        ? `Přepiš prosím následující recept do strukturovaného JSON formátu:

{
  "title": "Název receptu",
  "difficulty": "Beginner",
  "time": "00:20",
  "ingredients": [
    "Popis ingredience 1",
    "Popis ingredience 2"
  ],
  "steps": [
    { "description": "Popis kroku 1", "timerSeconds": 120 },
    { "description": "Popis kroku 2", "timerSeconds": 90 }
  ]
}

POŽADAVKY:
- Název, ingredience i kroky piš česky.
- ⚠️ Pole "difficulty" NIKDY nepřekládej. Musí být přesně jedno z:
  "Beginner", "Intermediate", "Hard".
- "time" nech ve formátu HH:MM.
- "steps" je pole kroků. Každý krok musí mít "description" a volitelné "timerSeconds".
- Odpověz POUZE čistým JSONem bez vysvětlení.

Tady je recept:`
        : `Please rewrite the following recipe into the structured JSON format below:

{
  "title": "Recipe title",
  "difficulty": "Beginner",
  "time": "00:20",
  "ingredients": [
    "Ingredient 1",
    "Ingredient 2"
  ],
  "steps": [
    { "description": "Step 1 description", "timerSeconds": 120 },
    { "description": "Step 2 description", "timerSeconds": 90 }
  ]
}

REQUIREMENTS:
- Title, ingredients and steps may be in the user’s language.
- ⚠️ The "difficulty" field must NEVER be translated. It must be exactly one of:
  "Beginner", "Intermediate", "Hard".
- Leave "time" in HH:MM.
- "steps" must be an array. Each step must contain "description" and optional "timerSeconds".
- Respond ONLY with clean JSON, no explanation.

Here is the recipe:`;

    await Clipboard.setStringAsync(prompt);

    Alert.alert(
      lang === "cs" ? "Zkopírováno" : "Copied",
      lang === "cs"
        ? "Prompt pro AI byl zkopírován."
        : "AI prompt has been copied."
    );
  }, [lang]);

  const importFromAiJson = useCallback(
    (raw: string) => {
      setAiImportErr(null);

      let parsed: any;
      try {
        parsed = JSON.parse(raw);
      } catch {
        setAiImportErr(
          lang === "cs" ? "Text není validní JSON." : "Text is not valid JSON."
        );
        return;
      }

      const validated = validateAiRecipeInput(lang, parsed);
      if (!validated.ok) {
        setAiImportErr(validated.error);
        return;
      }

      const data = validated.data;

      setTitle(data.title.trim());

      if (data.difficulty && DIFFICULTIES.includes(data.difficulty))
        setDifficulty(data.difficulty);
      else setDifficulty("Beginner");

      setTime(data.time.trim());

      setIngredients(
        data.ingredients.map((i) => String(i || "").trim()).filter(Boolean)
      );

      const mappedSteps: LocalStep[] = data.steps.map((s) => ({
        description: String(s.description || "").trim(),
        timerInput: secondsToHmsInput(s.timerSeconds),
        localUri: null,
        mediaType: null,
      }));

      setSteps(
        mappedSteps.length > 0
          ? mappedSteps
          : [
              {
                description: "",
                timerInput: "",
                localUri: null,
                mediaType: null,
              },
            ]
      );
    },
    [lang]
  );

  const handleSubmit = useCallback(async () => {
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

      for (let i = 0; i < steps.length; i++) {
        const raw = steps[i].timerInput.trim();
        if (!raw) continue;
        const seconds = parseTimerInput(raw);
        if (!seconds) {
          setErr(
            lang === "cs"
              ? `Krok ${
                  i + 1
                }: Časovač musí být ve formátu "mm:ss", "hh:mm:ss" nebo jako počet sekund.`
              : `Step ${
                  i + 1
                }: Timer must be in "mm:ss", "hh:mm:ss" or a number of seconds.`
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

      const payloadSteps = steps
        .map((s) => {
          const description = (s.description || "").trim();
          const base: any = { type: "text", description };

          const rawTimer = s.timerInput.trim();
          const seconds = rawTimer ? parseTimerInput(rawTimer) : null;
          if (seconds && seconds > 0) base.timerSeconds = seconds;

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
        isPublic: false,
      };

      const created = await fetchJSON<any>(`${BASE}/api/my-recipes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const recipeId = String(created?._id || "");
      if (!recipeId) throw new Error("Recipe creation failed (missing _id).");

      if (thumbUri) {
        const up = await uploadRecipeMediaMobile(token, recipeId, thumbUri);
        if (!up.ok) throw new Error(up.error);
      }

      const uploads = await Promise.all(
        steps.map(async (s, index) => {
          if (s.localUri && s.mediaType) {
            return uploadStepMediaMobile(
              token,
              recipeId,
              index,
              s.localUri,
              s.mediaType
            );
          }
          return { ok: true, data: true } as ActionResult<true>;
        })
      );

      const failed = uploads.find((r) => !r.ok) as
        | ActionResult<true>
        | undefined;
      if (failed && !failed.ok) throw new Error(failed.error);

      if (isPublic) {
        const pub = await publishRecipeMobile(token, recipeId);
        if (!pub.ok) throw new Error(pub.error);
      }

      setSuccessMsg(
        isPublic
          ? t(lang, "newRecipe", "recipeCreatedPublic")
          : t(lang, "newRecipe", "recipeCreated")
      );

      Alert.alert(
        lang === "cs" ? "Recept vytvořen" : "Recipe created",
        lang === "cs"
          ? "Recept byl úspěšně vytvořen."
          : "The recipe was successfully created."
      );

      setTitle("");
      setDifficulty("Beginner");
      setTime("");
      setIsPublic(false);
      setThumbUri(null);
      setThumbMediaType("image");
      setSteps([
        { description: "", timerInput: "", localUri: null, mediaType: null },
      ]);
      setIngredients([""]);
      setAiText("");
      setAiImportErr(null);
      setAiMode(false);
    } catch (e: any) {
      setErr(e?.message || t(lang, "newRecipe", "saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [title, difficulty, time, steps, ingredients, isPublic, thumbUri, lang]);

  /* =========================
     UI
  ========================= */

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

      {/* MAIN INFO */}
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
                  { backgroundColor: colors.card, borderColor: colors.border },
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
            style={{ color: time ? colors.text : colors.muted, fontSize: 14 }}
          >
            {time ||
              (lang === "cs" ? "Vyber čas (HH:MM)" : "Select time (HH:MM)")}
          </Text>
        </Pressable>

        {showTimePicker && (
          <DateTimePicker
            mode="time"
            display="spinner"
            value={timePickerDate}
            onChange={(_, date) => handleRecipeTimeChange(date || undefined)}
          />
        )}

        <View style={styles.publicRow}>
          <Text style={[styles.label, { color: colors.text }]}>
            {t(lang, "newRecipe", "publicLabel")}
          </Text>
          <Switch value={isPublic} onValueChange={setIsPublic} />
        </View>
      </View>

      {/* AI MODE */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View style={styles.aiHeaderRow}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {lang === "cs" ? "Vařím s AI" : "Cook with AI"}
          </Text>
          <Switch value={aiMode} onValueChange={setAiMode} />
        </View>

        {aiMode && (
          <>
            <Text style={{ color: colors.secondaryText, fontSize: 13 }}>
              {lang === "cs"
                ? `1. Otevřete AI (např. ChatGPT) a vložte váš recept.
2. Použijte níže uvedený JSON formát.
3. Název, ingredience i kroky mohou být v češtině.
4. ⚠️ Pole "difficulty" MUSÍ zůstat v angličtině: "Beginner" | "Intermediate" | "Hard".
5. AI musí odpovědět pouze čistým JSONem bez vysvětlení.`
                : `1. Open an AI assistant (e.g. ChatGPT) and paste your recipe.
2. Tell it to use the JSON format below.
3. Title, ingredients and steps may be in your language.
4. ⚠️ "difficulty" MUST stay in English: "Beginner" | "Intermediate" | "Hard".
5. AI must output ONLY clean JSON, no explanation.`}
            </Text>

            <View
              style={[
                styles.aiFormatBox,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.background,
                },
              ]}
            >
              <Text
                selectable
                style={{
                  color: colors.muted,
                  fontSize: 12,
                  fontFamily: "monospace",
                }}
              >
                {`{
  "title": "Avocado Toast with Egg",
  "difficulty": "Beginner",
  "time": "00:15",
  "ingredients": ["..."],
  "steps": [
    { "description": "First step...", "timerSeconds": 180 }
  ]
}`}
              </Text>
            </View>

            <Pressable
              style={[styles.aiCopyBtn, { borderColor: colors.border }]}
              onPress={handleCopyAiPrompt}
            >
              <Text style={[styles.aiCopyBtnText, { color: colors.text }]}>
                {lang === "cs"
                  ? "Zkopírovat celý prompt pro AI"
                  : "Copy full AI prompt"}
              </Text>
            </Pressable>

            {aiImportErr && (
              <Text style={[styles.error, { color: colors.danger }]}>
                {aiImportErr}
              </Text>
            )}

            <TextInput
              style={[
                styles.input,
                styles.aiTextInput,
                {
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              multiline
              placeholder={
                lang === "cs"
                  ? "Sem vložte JSON z AI..."
                  : "Paste the JSON text from AI here..."
              }
              placeholderTextColor={colors.muted}
              value={aiText}
              onChangeText={setAiText}
            />

            <Pressable
              style={[styles.aiImportBtn, { borderColor: colors.border }]}
              onPress={() => importFromAiJson(aiText)}
            >
              <Text style={[styles.aiImportBtnText, { color: colors.text }]}>
                {lang === "cs" ? "Načíst z AI textu" : "Import from AI text"}
              </Text>
            </Pressable>
          </>
        )}
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
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

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          {t(lang, "newRecipe", "stepsTitle")}
        </Text>

        {steps.map((step, index) => {
          const { h, m, s } = splitTimerHMS(step.timerInput);

          return (
            <View
              key={index}
              style={[
                styles.stepCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.stepHeaderRow}>
                <Text style={[styles.stepTitle, { color: colors.text }]}>
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
              </View>
            </View>
          );
        })}

        <Pressable
          style={[styles.addBtn, { borderColor: colors.border }]}
          onPress={addStep}
        >
          <Text style={[styles.addBtnText, { color: colors.text }]}>
            {t(lang, "newRecipe", "addStepBtn")}
          </Text>
        </Pressable>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
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

      <Pressable
        style={[
          styles.submitBtn,
          { backgroundColor: colors.pillActive },
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

/* =========================
   STYLES
========================= */

const styles = StyleSheet.create({
  container: {
    padding: 16,
    paddingBottom: 32,
    gap: 16,
    paddingTop: 40,
  },

  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
  },

  label: {
    marginBottom: 4,
    fontSize: 14,
  },

  input: {
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    marginBottom: 12,
    fontSize: 14,
  },

  multilineInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },

  sectionTitle: {
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 8,
  },

  difficultyRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
    flexWrap: "wrap",
  },

  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },

  chipText: {
    fontSize: 13,
    fontWeight: "600",
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
    fontSize: 13,
    textAlign: "center",
  },

  stepCard: {
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
  },

  stepHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },

  stepTitle: {
    fontWeight: "600",
  },

  stepMediaBox: {
    borderRadius: 10,
    borderWidth: 1,
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

  timerRow: { marginTop: 4 },

  timerLabel: {
    fontSize: 12,
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
    fontSize: 12,
  },

  timerFieldInput: {
    minWidth: 50,
    textAlign: "center",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderWidth: 1,
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
    alignItems: "center",
  },

  addBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },

  submitBtn: {
    marginTop: 8,
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
  },

  submitBtnDisabled: { opacity: 0.6 },

  submitBtnText: {
    fontSize: 16,
    fontWeight: "700",
  },

  removeBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },

  removeBtnText: {
    fontWeight: "700",
    fontSize: 12,
  },

  error: { marginBottom: 4 },
  success: { marginBottom: 4 },

  aiHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },

  aiFormatBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 8,
    marginTop: 8,
    marginBottom: 8,
  },

  aiTextInput: {
    minHeight: 120,
    textAlignVertical: "top",
  },

  aiImportBtn: {
    marginTop: 8,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: "center",
  },

  aiImportBtnText: {
    fontSize: 14,
    fontWeight: "600",
  },

  aiCopyBtn: {
    alignSelf: "flex-start",
    marginTop: 4,
    marginBottom: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    borderWidth: 1,
  },

  aiCopyBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },
});

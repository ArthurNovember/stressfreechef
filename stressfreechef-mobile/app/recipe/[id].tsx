import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Vibration,
  Platform,
  ActivityIndicator,
} from "react-native";

import { useKeepAwake } from "expo-keep-awake";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Video, ResizeMode } from "expo-av";
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from "expo-speech-recognition";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { MaterialIcons } from "@expo/vector-icons";

import { t, Lang, LANG_KEY } from "../../i18n/strings";
import { useTheme } from "../../theme/ThemeContext";
import { API_BASE } from "../../lib/api";

/* =========================
   TYPES
========================= */

type MaterialIconName = React.ComponentProps<typeof MaterialIcons>["name"];

type Step = {
  type: "image" | "video" | "text";
  src?: string;
  description: string;
  descriptionCs?: string;
  timerSeconds?: number;
};

type Recipe = {
  _id?: string;
  id?: string;
  title: string;
  titleCs?: string;
  imgSrc: string;
  difficulty: string;
  time: string;
  steps?: Step[];
  image?: { url?: string };
  ratingAvg?: number;
  ratingCount?: number;
  sourceRecipeId?: string;
  owner?: any;
  ratings?: any;
};

/* =========================
   CONSTS
========================= */

const BASE = API_BASE || "https://stressfreecheff-backend.onrender.com";
const TOKEN_KEY = "token";
const VOICE_ENABLED_KEY = "settings:voiceEnabled";

/* =========================
   STORAGE
========================= */

async function getToken() {
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

async function loadBlowNextEnabled(): Promise<boolean> {
  try {
    const stored = await AsyncStorage.getItem(VOICE_ENABLED_KEY);
    return stored === "1";
  } catch {
    return false;
  }
}

/* =========================
   HELPERS 
========================= */

function getRecipeTitle(r: Recipe, lang: Lang) {
  if (lang === "cs" && (r as any).titleCs) return (r as any).titleCs as string;
  return r.title;
}

function getStepDescription(step: Step | undefined, lang: Lang): string {
  if (!step) return "";
  if (lang === "cs" && (step as any).descriptionCs)
    return (step as any).descriptionCs as string;
  return step.description || "";
}

function parseTimerSeconds(step: Step | undefined) {
  const raw =
    typeof step?.timerSeconds === "number"
      ? step.timerSeconds
      : Number((step as any)?.timerSeconds ?? 0);

  if (!raw || !Number.isFinite(raw) || raw <= 0) return null;
  return Math.floor(raw);
}

function formatTime(totalSeconds: number) {
  const safe = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function vibrateTimerDone() {
  if (Platform.OS === "android")
    Vibration.vibrate([0, 300, 150, 300, 150, 300]);
  else Vibration.vibrate();
}

function inferCommunityIdFromRecipe(
  recipe: Recipe | null,
  paramsCommunityId?: string | null
) {
  if (paramsCommunityId) return String(paramsCommunityId);

  if (!recipe) return null;

  const anyRecipe = recipe as any;
  const hasCommunityFields =
    typeof anyRecipe.ratingAvg === "number" ||
    typeof anyRecipe.ratingCount === "number";

  if (hasCommunityFields) return String(anyRecipe._id || anyRecipe.id || "");

  if (anyRecipe.sourceRecipeId || anyRecipe.owner || anyRecipe.ratings) {
    return String(anyRecipe._id || anyRecipe.id || "");
  }

  return null;
}

/* =========================
   API 
========================= */

async function ensureCommunityFromRecipe(recipeId: string) {
  const res = await fetch(
    `${BASE}/api/community-recipes/ensure-from-recipe/${recipeId}`,
    {
      method: "POST",
    }
  );
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "ensure failed");
  return data as { _id: string; ratingAvg: number; ratingCount: number };
}

async function fetchCommunityStats(communityId: string) {
  const res = await fetch(`${BASE}/api/community-recipes/${communityId}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || "Failed to load community stats");
  return data as { ratingAvg: number; ratingCount: number };
}

async function submitRatingApi(
  communityId: string,
  token: string,
  value: number
) {
  const res = await fetch(`${BASE}/api/community-recipes/${communityId}/rate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ value }),
  });

  const raw = await res.text();
  if (!res.ok) throw new Error(raw || "Failed to rate.");
  return JSON.parse(raw) as { ratingAvg: number; ratingCount: number };
}

/* =========================
   UI: Stars
========================= */

function Stars({
  avg,
  myRating,
  disabled,
  onRate,
}: {
  avg: number;
  myRating: number;
  disabled: boolean;
  onRate: (value: number) => void;
}) {
  const effective = myRating || avg;

  return (
    <View style={s.starsRow}>
      {[1, 2, 3, 4, 5].map((star) => {
        const diff = effective - (star - 1);
        let icon: MaterialIconName = "star-border";
        if (diff >= 0.75) icon = "star";
        else if (diff >= 0.25) icon = "star-half";

        return (
          <Pressable
            key={star}
            disabled={disabled}
            onPress={() => onRate(star)}
            style={s.starPressable}
          >
            <MaterialIcons
              name={icon}
              size={32}
              color={icon === "star-border" ? "#555" : "#ffd700"}
              style={disabled ? { opacity: 0.4 } : undefined}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

/* =========================
   SCREEN
========================= */

export default function RecipeStepsScreen() {
  useKeepAwake();
  const { colors } = useTheme();
  const router = useRouter();

  const params = useLocalSearchParams<{
    id: string;
    recipe?: string;
    communityRecipeId?: string;
    source?: string;
  }>();

  const source =
    (params.source as "home" | "explore" | "profile" | undefined) ?? "home";

  const recipe: Recipe | null = useMemo(() => {
    try {
      return params?.recipe
        ? (JSON.parse(String(params.recipe)) as Recipe)
        : null;
    } catch {
      return null;
    }
  }, [params?.recipe]);

  const steps = recipe?.steps || [];

  const [lang, setLang] = useState<Lang>("en");
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  const [current, setCurrent] = useState(0);

  const [remaining, setRemaining] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [accumulated, setAccumulated] = useState(0);
  const [justFinished, setJustFinished] = useState(false);

  const paramsCommunityId =
    (params as any)?.communityRecipeId || (params as any)?.communityId;
  const [communityId, setCommunityId] = useState<string | null>(() =>
    inferCommunityIdFromRecipe(
      recipe,
      paramsCommunityId ? String(paramsCommunityId) : null
    )
  );
  const [ensuring, setEnsuring] = useState(false);

  const [community, setCommunity] = useState({
    avg: Number((recipe as any)?.ratingAvg ?? 0) || 0,
    count: Number((recipe as any)?.ratingCount ?? 0) || 0,
  });
  const [myRating, setMyRating] = useState(0);
  const [rateMsg, setRateMsg] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [ratingBusy, setRatingBusy] = useState(false);

  const step = steps[current];
  const stepTimer = parseTimerSeconds(step);
  const hasTimer = stepTimer != null;

  const canRateCommunity = Boolean(communityId) && !ensuring;

  const handleBack = useCallback(() => {
    if (source === "explore") router.replace("/(tabs)/explore");
    else if (source === "profile") router.replace("/(tabs)/profile");
    else router.replace("/(tabs)/home");
  }, [router, source]);

  /* =========================
    Effects
  ========================= */

  useEffect(() => {
    (async () => setLang(await loadLang()))();
  }, []);

  useEffect(() => {
    (async () => setVoiceEnabled(await loadBlowNextEnabled()))();
  }, []);

  useEffect(() => {
    if (!step) {
      setRemaining(null);
      setIsRunning(false);
      setStartedAt(null);
      setAccumulated(0);
      setJustFinished(false);
      return;
    }

    if (!hasTimer) {
      setRemaining(null);
      setIsRunning(false);
      setStartedAt(null);
      setAccumulated(0);
      setJustFinished(false);
      return;
    }

    setRemaining(stepTimer!);
    setIsRunning(false);
    setStartedAt(null);
    setAccumulated(0);
    setJustFinished(false);
  }, [current, hasTimer, stepTimer, step]);

  useEffect(() => {
    if (!isRunning || startedAt == null || !hasTimer) return;

    const duration = stepTimer!;
    const id = setInterval(() => {
      const elapsedSinceStart = (Date.now() - startedAt) / 1000;
      const totalElapsed = accumulated + elapsedSinceStart;
      const nextRemaining = Math.max(0, duration - Math.floor(totalElapsed));

      setRemaining(nextRemaining);

      if (nextRemaining <= 0) {
        setIsRunning(false);
        setStartedAt(null);
        setAccumulated(duration);
        setJustFinished(true);
        vibrateTimerDone();
      }
    }, 1000);

    return () => clearInterval(id);
  }, [isRunning, startedAt, accumulated, hasTimer, stepTimer]);

  useEffect(() => {
    if (!recipe?._id) return;
    if (communityId) return;

    const anyRecipe = recipe as any;
    const hasCommunityFields =
      typeof anyRecipe.ratingAvg === "number" ||
      typeof anyRecipe.ratingCount === "number";
    if (hasCommunityFields) return;

    let aborted = false;

    (async () => {
      try {
        setEnsuring(true);
        const data = await ensureCommunityFromRecipe(String(recipe!._id));
        if (aborted) return;

        setCommunityId(String(data._id));
        setCommunity({
          avg: Number(data.ratingAvg || 0),
          count: Number(data.ratingCount || 0),
        });
      } catch (e) {
        console.warn("ensure community failed:", e);
      } finally {
        if (!aborted) setEnsuring(false);
      }
    })();

    return () => {
      aborted = true;
    };
  }, [recipe?._id, communityId]);

  useEffect(() => {
    if (!communityId) return;

    let aborted = false;

    (async () => {
      try {
        const data = await fetchCommunityStats(communityId);
        if (aborted) return;

        setCommunity({
          avg: Number(data.ratingAvg || 0),
          count: Number(data.ratingCount || 0),
        });
      } catch (e: any) {
        console.warn(
          "Failed to fetch community recipe:",
          e?.message || String(e)
        );
      }
    })();

    return () => {
      aborted = true;
    };
  }, [communityId]);

  async function submitRating(value: number) {
    try {
      setRateMsg(null);

      if (!canRateCommunity || !communityId) {
        setRateMsg({
          type: "error",
          text: t(lang, "recipe", "ratingNotAvailable"),
        });
        return;
      }

      const token = await getToken();
      if (!token) {
        setRateMsg({ type: "error", text: t(lang, "recipe", "loginRequired") });
        return;
      }

      setRatingBusy(true);
      const data = await submitRatingApi(communityId, token, value);

      setMyRating(value);
      setCommunity({ avg: data.ratingAvg, count: data.ratingCount });
      setRateMsg({
        type: "ok",
        text: `${t(lang, "recipe", "ratingThanks")} ★${data.ratingAvg.toFixed(
          2
        )} (${data.ratingCount})`,
      });
    } catch {
      setRateMsg({ type: "error", text: t(lang, "recipe", "ratingFailed") });
    } finally {
      setRatingBusy(false);
    }
  }

  /* =========================
    Handlers
  ========================= */

  const handleStartPause = useCallback(() => {
    if (!hasTimer) return;

    if (!isRunning) {
      setJustFinished(false);

      if (remaining == null || remaining <= 0) {
        setAccumulated(0);
        setRemaining(stepTimer!);
      }

      setStartedAt(Date.now());
      setIsRunning(true);
      return;
    }

    if (startedAt != null) {
      const elapsedSinceStart = (Date.now() - startedAt) / 1000;
      setAccumulated((acc) => acc + elapsedSinceStart);
    }

    setStartedAt(null);
    setIsRunning(false);
  }, [hasTimer, isRunning, remaining, startedAt, stepTimer]);

  const handleResetTimer = useCallback(() => {
    setIsRunning(false);
    setStartedAt(null);
    setAccumulated(0);
    setJustFinished(false);

    if (hasTimer) setRemaining(stepTimer!);
    else setRemaining(null);
  }, [hasTimer, stepTimer]);

  /* =========================k
    VOICE COMMANDS
  ========================= */

  useVoiceCommands(voiceEnabled, {
    onNext: () => setCurrent((p) => Math.min(steps.length - 1, p + 1)),
    onPrev: () => setCurrent((p) => Math.max(0, p - 1)),

    onStartTimer: () => {
      if (hasTimer && !isRunning) handleStartPause();
    },
    onPauseTimer: () => {
      if (hasTimer && isRunning) handleStartPause();
    },
    onResetTimer: () => {
      if (hasTimer) handleResetTimer(); // 👈 uprav na název tvé reset funkce
    },
  });

  /* =========================
     EMPTY STATE
  ========================= */

  if (!recipe || steps.length === 0) {
    return (
      <View style={[s.center, { backgroundColor: colors.background }]}>
        <Text style={[s.err, { color: colors.danger }]}>
          {t(lang, "recipe", "stepsUnavailable")}
        </Text>
        <Pressable
          style={[
            s.primary,
            {
              backgroundColor: colors.pillActive,
              borderColor: colors.pillActive,
            },
          ]}
          onPress={handleBack}
        >
          <Text style={[s.primaryText, { color: colors.text }]}>
            {t(lang, "recipe", "back")}
          </Text>
        </Pressable>
      </View>
    );
  }

  const displaySeconds =
    remaining != null ? remaining : hasTimer ? stepTimer! : 0;

  /* =========================
     RENDER
  ========================= */

  return (
    <View style={[s.wrapper, { backgroundColor: colors.background }]}>
      <View
        style={[
          s.card,
          { justifyContent: "space-between", backgroundColor: colors.card },
        ]}
      >
        <View>
          <Text style={[s.title, { color: colors.text }]}>
            {getRecipeTitle(recipe, lang)}
          </Text>
          <Text style={[s.meta, { color: colors.secondaryText }]}>
            {t(lang, "recipe", "step")} {current + 1} / {steps.length}
          </Text>

          {step.type === "image" && (
            <Image source={{ uri: step.src }} style={s.stepImg} />
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

          {step.type === "text" && (
            <View
              style={[
                s.textStep,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            />
          )}

          <Text style={[s.description, { color: colors.text }]}>
            {getStepDescription(step, lang)}
          </Text>

          {/* ⏱ Timer */}
          {hasTimer && (
            <View style={[s.timerBox, { borderColor: colors.border }]}>
              <View style={[s.timerCircle, { borderColor: colors.text }]}>
                <Text style={[s.timerValue, { color: colors.text }]}>
                  {formatTime(displaySeconds)}
                </Text>
              </View>

              {justFinished && (
                <Text style={[s.timerFinishedLabel, { color: colors.danger }]}>
                  {t(lang, "recipe", "timerDone")}
                </Text>
              )}

              <View style={s.timerRow}>
                <Pressable
                  style={[
                    s.timerBtn,
                    { borderColor: colors.text, backgroundColor: colors.card },
                    isRunning && s.timerBtnActive,
                  ]}
                  onPress={handleStartPause}
                >
                  <Text
                    style={[
                      s.timerBtnText,
                      { color: colors.pillActive },
                      isRunning && s.timerBtnActiveText,
                    ]}
                  >
                    {isRunning ? "❚❚" : "▶"}
                  </Text>
                </Pressable>

                <Pressable
                  style={[
                    s.timerBtn,
                    { borderColor: colors.text, backgroundColor: colors.card },
                  ]}
                  onPress={handleResetTimer}
                >
                  <Text style={[s.timerBtnText, { color: colors.pillActive }]}>
                    ■
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>

        {current === steps.length - 1 && (
          <View style={s.ratingBox}>
            <Text style={[s.completedLabel, { color: colors.text }]}>
              {t(lang, "recipe", "completed")}
            </Text>
            <Text style={[s.ratingLabel, { color: colors.secondaryText }]}>
              {t(lang, "recipe", "rateThis")}
            </Text>

            <Stars
              avg={community.avg}
              myRating={myRating}
              disabled={!canRateCommunity || ratingBusy}
              onRate={submitRating}
            />

            {community.count > 0 && (
              <Text style={[s.ratingMeta, { color: colors.secondaryText }]}>
                {community.avg.toFixed(1)} ({community.count})
              </Text>
            )}

            {rateMsg && (
              <Text
                style={[
                  s.ratingMsg,
                  rateMsg.type === "ok" ? s.ratingMsgOk : s.ratingMsgErr,
                ]}
              >
                {rateMsg.text}
              </Text>
            )}

            {!canRateCommunity && (
              <Text style={[s.ratingDisabled, { color: colors.muted }]}>
                {ensuring
                  ? t(lang, "recipe", "preparing")
                  : t(lang, "recipe", "cannotRate")}
              </Text>
            )}
          </View>
        )}

        <View style={s.row}>
          <Pressable
            disabled={current === 0}
            onPress={() => setCurrent((p) => Math.max(0, p - 1))}
            style={[
              s.btn,
              { borderColor: colors.border, backgroundColor: colors.border },
              current === 0 && s.btnDisabled,
            ]}
          >
            <Text style={[s.btnText, { color: colors.text }]}>
              {t(lang, "recipe", "previous")}
            </Text>
          </Pressable>

          {current < steps.length - 1 ? (
            <Pressable
              onPress={() =>
                setCurrent((p) => Math.min(steps.length - 1, p + 1))
              }
              style={[
                s.btn,
                s.btnPrimary,
                {
                  backgroundColor: colors.pillActive,
                  borderColor: colors.pillActive,
                },
              ]}
            >
              <Text style={[s.btnText, { color: "white" }]}>
                {t(lang, "recipe", "next")}
              </Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={handleBack}
              style={[
                s.btn,
                s.btnPrimary,
                {
                  backgroundColor: colors.pillActive,
                  borderColor: colors.pillActive,
                },
              ]}
            >
              <Text style={[s.btnText, { color: colors.text }]}>
                {t(lang, "recipe", "finish")}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </View>
  );
}

/* =========================
   HOOK: blow-to-next-step
========================= */

function useVoiceCommands(
  enabled: boolean,
  handlers: {
    onNext: () => void;
    onPrev: () => void;

    onStartTimer: () => void;
    onPauseTimer: () => void;
    onResetTimer: () => void;
  }
) {
  const handlersRef = useRef(handlers);

  const recognizingRef = useRef(false);
  const restartingRef = useRef(false);

  const lastCommandAtRef = useRef(0);
  const lastTranscriptRef = useRef("");

  useEffect(() => {
    handlersRef.current = handlers;
  }, [handlers]);

  const start = useCallback(async () => {
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) return;

    recognizingRef.current = true;

    ExpoSpeechRecognitionModule.start({
      lang: "en-US",
      interimResults: false,
      continuous: true,
    });
  }, []);

  const stop = useCallback(() => {
    if (!recognizingRef.current) return;
    recognizingRef.current = false;
    restartingRef.current = false;
    ExpoSpeechRecognitionModule.abort();
  }, []);

  const restart = useCallback(() => {
    if (!recognizingRef.current) return;

    restartingRef.current = true;
    lastTranscriptRef.current = "";

    ExpoSpeechRecognitionModule.abort();

    setTimeout(() => {
      if (!recognizingRef.current) {
        restartingRef.current = false;
        return;
      }

      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: false,
        continuous: true,
      });

      restartingRef.current = false;
    }, 180);
  }, []);

  useSpeechRecognitionEvent("result", (event) => {
    const text =
      (event?.results?.[0]?.transcript ?? event?.results?.[0] ?? "") + "";

    const s = text.toLowerCase().trim();
    if (!s) return;

    // ignore duplicate transcripts (Android často posílá stejné)
    if (s === lastTranscriptRef.current) return;
    lastTranscriptRef.current = s;

    const words = s.split(/\s+/).filter(Boolean);
    const last1 = words.at(-1) ?? "";
    const last2 = words.slice(-2).join(" "); // "start timer"
    const last3 = words.slice(-3).join(" "); // pro jistotu, kdyby engine udělal "reset the timer" apod.

    const now = Date.now();
    if (now - lastCommandAtRef.current < 600) return;

    let handled = false;

    // ----- TIMER commands -----
    // start timer
    if (last2 === "start timer") {
      handled = true;
      handlersRef.current.onStartTimer();

      // pause timer
    } else if (last2 === "pause timer" || last2 === "stop timer") {
      handled = true;
      handlersRef.current.onPauseTimer();

      // reset timer
    } else if (last2 === "reset timer" || last3 === "reset the timer") {
      handled = true;
      handlersRef.current.onResetTimer();

      // ----- NAV commands -----
    } else if (last1 === "next") {
      handled = true;
      handlersRef.current.onNext();
    } else if (last1 === "previous" || last1 === "prev" || last1 === "back") {
      handled = true;
      handlersRef.current.onPrev();
    }

    if (handled) {
      lastCommandAtRef.current = now;
      restart();
    }
  });

  useSpeechRecognitionEvent("end", () => {
    if (!recognizingRef.current) return;
    if (restartingRef.current) return;

    setTimeout(() => {
      if (!recognizingRef.current) return;
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: false,
        continuous: true,
      });
    }, 220);
  });

  useSpeechRecognitionEvent("error", () => {
    if (!recognizingRef.current) return;
    if (restartingRef.current) return;

    setTimeout(() => {
      if (!recognizingRef.current) return;
      lastTranscriptRef.current = "";
      ExpoSpeechRecognitionModule.start({
        lang: "en-US",
        interimResults: false,
        continuous: true,
      });
    }, 320);
  });

  useEffect(() => {
    if (!enabled) {
      stop();
      return;
    }

    start();

    return () => {
      stop();
    };
  }, [enabled, start, stop]);
}

/* =========================
   STYLES
========================= */

const s = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#000" },

  card: {
    flex: 1,
    padding: 16,
    paddingTop: 45,
  },

  title: { fontSize: 20, fontWeight: "800" },
  meta: { opacity: 0.7, marginTop: 4, marginBottom: 8 },

  stepImg: {
    width: "100%",
    aspectRatio: 16 / 9,
    borderRadius: 12,
    backgroundColor: "#333",
  },

  textStep: {
    padding: 12,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },

  description: {
    marginTop: 8,
    fontSize: 16,
    lineHeight: 22,
  },

  row: { flexDirection: "row", gap: 12, paddingBottom: 30 },

  btn: {
    flex: 1,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.4 },
  btnPrimary: {},

  btnText: { fontWeight: "800" },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  err: { fontWeight: "700", marginBottom: 12 },

  primary: {
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1,
  },
  primaryText: { fontWeight: "800" },

  timerBox: { marginTop: 16, padding: 12, borderWidth: 0 },
  timerValue: { fontSize: 24, fontWeight: "800", letterSpacing: 2 },

  timerRow: {
    flexDirection: "row",
    gap: 30,
    marginTop: 12,
    justifyContent: "center",
  },

  timerBtn: {
    borderRadius: 70,
    borderWidth: 0.5,
    alignItems: "center",
    width: 50,
    height: 50,
  },

  timerBtnActive: { backgroundColor: "#111", borderColor: "#111" },
  timerBtnActiveText: { fontSize: 20, position: "relative", top: 10 },

  timerBtnText: { fontSize: 33, position: "relative", bottom: 1 },

  timerCircle: {
    marginTop: 8,
    alignSelf: "center",
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },

  timerFinishedLabel: { marginTop: 8, textAlign: "center", fontWeight: "800" },

  ratingBox: { paddingHorizontal: 4, paddingVertical: 8, alignItems: "center" },
  completedLabel: { fontWeight: "800", marginBottom: 4 },
  ratingLabel: { marginBottom: 6 },

  starsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 6,
  },
  starPressable: { padding: 2 },

  ratingMeta: { fontSize: 12, marginTop: 2 },
  ratingMsg: { marginTop: 4, fontSize: 12, textAlign: "center" },
  ratingMsgOk: { color: "limegreen" },
  ratingMsgErr: { color: "tomato" },
  ratingDisabled: { marginTop: 4, fontSize: 12, textAlign: "center" },
});

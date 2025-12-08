import { t, Lang, LANG_KEY } from "../../i18n/strings";
import { useTheme } from "../../theme/ThemeContext";
import { Audio } from "expo-av";

import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  Image,
  StyleSheet,
  Pressable,
  Vibration,
  Platform,
} from "react-native";
import { Video, ResizeMode } from "expo-av";
import { useKeepAwake } from "expo-keep-awake";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_BASE } from "../../lib/api";
import { MaterialIcons } from "@expo/vector-icons";
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
};

const BASE = API_BASE || "https://stressfreecheff-backend.onrender.com";
const TOKEN_KEY = "token";
const BLOW_NEXT_KEY = "settings:blowNextEnabled"; // 👈 stejný key jako v Settings
async function getToken() {
  return (await AsyncStorage.getItem(TOKEN_KEY)) || "";
}

export default function RecipeStepsScreen() {
  useKeepAwake();
  const { colors } = useTheme(); // 🎨 tady máš theme barvy
  const router = useRouter();
  function handleBack() {
    if (source === "explore") {
      router.replace("/(tabs)/explore");
    } else if (source === "profile") {
      router.replace("/(tabs)/profile");
    } else {
      // default – když něco chybí, vrať se na home
      router.replace("/(tabs)/home");
    }
  }
  const params = useLocalSearchParams<{
    id: string;
    recipe?: string; // JSON předaný z Home (dočasně)
    communityRecipeId?: string; // volitelně, když se bude posílat z Explore
    source?: string;
  }>();

  const source =
    (params.source as "home" | "explore" | "profile" | undefined) ?? "home";

  // ⚠️ Dočasný zdroj dat ze stringu (rychlá integrace)
  let recipe: Recipe | null = null;
  try {
    recipe = params?.recipe ? JSON.parse(String(params.recipe)) : null;
  } catch {
    recipe = null;
  }

  const [current, setCurrent] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [accumulated, setAccumulated] = useState(0);
  const [justFinished, setJustFinished] = useState(false);
  const steps = recipe?.steps || [];

  const [lang, setLang] = useState<Lang>("en");
  const [blowNextEnabled, setBlowNextEnabled] = useState(false); // 👈 nový state

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(LANG_KEY);
      if (stored === "cs" || stored === "en") setLang(stored);
    })();
  }, []);

  useEffect(() => {
    (async () => {
      const stored = await AsyncStorage.getItem(BLOW_NEXT_KEY);
      setBlowNextEnabled(stored === "1");
    })();
  }, []);

  function getRecipeTitle(r: Recipe, lang: Lang) {
    if (lang === "cs" && (r as any).titleCs) {
      return (r as any).titleCs as string;
    }
    return r.title;
  }

  function getStepDescription(step: any, lang: Lang): string {
    if (!step) return "";
    if (lang === "cs" && step.descriptionCs) {
      return step.descriptionCs as string;
    }
    return step.description || "";
  }

  const paramsCommunityId =
    (params as any)?.communityRecipeId || (params as any)?.communityId;

  const [communityId, setCommunityId] = useState<string | null>(() => {
    if (paramsCommunityId) return String(paramsCommunityId);

    const anyRecipe = recipe as any;
    if (!anyRecipe) return null;

    const hasCommunityFields =
      typeof anyRecipe.ratingAvg === "number" ||
      typeof anyRecipe.ratingCount === "number";

    // ✅ Recept už má ratingAvg / ratingCount → je to community recipe
    // → jeho _id je to, co posíláme do /api/community-recipes/:id/rate
    if (hasCommunityFields) {
      return String(anyRecipe._id || anyRecipe.id || "");
    }

    // ✅ Další pojistka: community recepty často mají sourceRecipeId / owner / ratings
    if (anyRecipe.sourceRecipeId || anyRecipe.owner || anyRecipe.ratings) {
      return String(anyRecipe._id || anyRecipe.id || "");
    }

    // ❌ Ofiko recept → community kopii později zajistí useEffect (ensure-from-recipe)
    return null;
  });

  const [ensuring, setEnsuring] = useState(false);
  const [myRating, setMyRating] = useState(0);
  const [rateMsg, setRateMsg] = useState<{
    type: "ok" | "error";
    text: string;
  } | null>(null);
  const [community, setCommunity] = useState({
    avg: Number((recipe as any)?.ratingAvg ?? 0) || 0,
    count: Number((recipe as any)?.ratingCount ?? 0) || 0,
  });
  const [ratingBusy, setRatingBusy] = useState(false);
  const canRateCommunity = Boolean(communityId) && !ensuring;

  useEffect(() => {
    const currentStep = steps[current];

    if (!currentStep) {
      setRemaining(null);
      setIsRunning(false);
      setStartedAt(null);
      setAccumulated(0);
      setJustFinished(false);
      return;
    }

    // přepočítáme timer na číslo (podporuje number i string)
    const raw =
      typeof currentStep.timerSeconds === "number"
        ? currentStep.timerSeconds
        : Number(currentStep.timerSeconds ?? 0);

    if (!raw || !Number.isFinite(raw) || raw <= 0) {
      // žádný validní timer
      setRemaining(null);
      setIsRunning(false);
      setStartedAt(null);
      setAccumulated(0);
      setJustFinished(false);
      return;
    }

    // nový krok → nastavíme výchozí hodnotu
    setRemaining(raw);
    setIsRunning(false);
    setStartedAt(null);
    setAccumulated(0);
    setJustFinished(false);
  }, [current]);

  useEffect(() => {
    const currentStep = steps[current];

    if (!isRunning || startedAt == null || !currentStep) {
      return;
    }

    const raw =
      typeof currentStep.timerSeconds === "number"
        ? currentStep.timerSeconds
        : Number(currentStep.timerSeconds ?? 0);

    const duration = Number.isFinite(raw) && raw > 0 ? raw : null;

    if (!duration) {
      // něco je špatně -> radši timer zastavíme
      setIsRunning(false);
      return;
    }

    const id = setInterval(() => {
      const elapsedSinceStart = (Date.now() - startedAt) / 1000;
      const totalElapsed = accumulated + elapsedSinceStart;
      const nextRemaining = Math.max(0, duration - Math.floor(totalElapsed));

      setRemaining(nextRemaining);

      if (nextRemaining <= 0) {
        // ⏱ timer doběhl → zastavíme ho a upozorníme
        setIsRunning(false);
        setStartedAt(null);
        setAccumulated(duration);
        setJustFinished(true);

        vibrateTimerDone();
      }
    }, 1000);

    return () => clearInterval(id);
  }, [isRunning, startedAt, accumulated, current]);

  useEffect(() => {
    if (!recipe || !recipe._id) return;
    // pokud už communityId máme (community recipe nebo z params), hotovo
    if (communityId) return;
    const anyRecipe = recipe as any;
    const hasCommunityFields =
      typeof anyRecipe.ratingAvg === "number" ||
      typeof anyRecipe.ratingCount === "number";
    // pokud už v receptu jsou ratingAvg / ratingCount, taky to necháme být
    if (hasCommunityFields) return;
    let aborted = false;
    (async () => {
      try {
        setEnsuring(true);
        const res = await fetch(
          `${BASE}/api/community-recipes/ensure-from-recipe/${recipe!._id}`,
          { method: "POST" }
        );
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || "ensure failed");
        if (!aborted) {
          setCommunityId(String(data._id));
          setCommunity({
            avg: Number(data.ratingAvg || 0),
            count: Number(data.ratingCount || 0),
          });
        }
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
        const res = await fetch(`${BASE}/api/community-recipes/${communityId}`);
        const data = await res.json();
        if (!res.ok)
          throw new Error(data?.error || "Failed to load community stats");
        if (!aborted) {
          setCommunity({
            avg: Number(data.ratingAvg || 0),
            count: Number(data.ratingCount || 0),
          });
        }
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

  const formatTime = (totalSeconds: number) => {
    const safe = Math.max(0, Math.floor(totalSeconds || 0));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return `${mm}:${ss}`;
  };

  const step = steps[current];

  const rawTimer =
    typeof step?.timerSeconds === "number"
      ? step.timerSeconds
      : Number(step?.timerSeconds ?? 0);

  const hasTimer = rawTimer > 0;

  // 🔁 Kdykoliv se změní krok → resetneme stav timeru pro nový krok
  useEffect(() => {
    // stopneme případný běžící timer z předchozího kroku
    setIsRunning(false);
    setStartedAt(null);
    setJustFinished(false);
    setAccumulated(0);

    // připravíme "čistý" remaining pro nový krok
    if (hasTimer && rawTimer > 0) {
      setRemaining(rawTimer);
    } else {
      setRemaining(null);
    }
  }, [current, hasTimer, rawTimer]);

  // ⬇️ sem vlož handleStartPause
  const handleStartPause = () => {
    if (!hasTimer) return;

    if (!isRunning) {
      setJustFinished(false);

      if (remaining == null || remaining <= 0) {
        setAccumulated(0);
        if (rawTimer > 0) setRemaining(rawTimer);
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
  };

  const handleBlow = useCallback(() => {
    // 1) Pokud má aktuální krok timer a neběží → fouknutím ho jen spustíme
    if (hasTimer && !isRunning) {
      handleStartPause();
      return;
    }

    // 2) Jinak posuneme krok dál
    setCurrent((p) => Math.min(steps.length - 1, p + 1));
  }, [hasTimer, isRunning, handleStartPause, setCurrent, steps.length]);

  useBlowToNextStep(
    blowNextEnabled && current < steps.length - 1,
    handleBlow,
    [current] // stačí current, ostatní je uvnitř handleBlow
  );

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

  // Timer bereme jen pokud je > 0 (0 = vlastně žádný timer)

  const displaySeconds =
    remaining != null ? remaining : hasTimer ? rawTimer : 0;

  const vibrateTimerDone = () => {
    if (Platform.OS === "android") {
      // 3 krátké pulzy: bzz – pauza – bzz – pauza – bzz
      Vibration.vibrate([0, 300, 150, 300, 150, 300]);
    } else {
      // iOS stejně dělá jen default vibraci
      Vibration.vibrate();
    }
  };

  async function submitRating(intValue: number) {
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
        setRateMsg({
          type: "error",
          text: t(lang, "recipe", "loginRequired"),
        });
        return;
      }
      setRatingBusy(true);
      const res = await fetch(
        `${BASE}/api/community-recipes/${communityId}/rate`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ value: intValue }), // 1..5
        }
      );
      const raw = await res.text();
      if (!res.ok) throw new Error(raw || "Failed to rate.");
      const data = JSON.parse(raw);
      setMyRating(intValue);
      setCommunity({
        avg: data.ratingAvg,
        count: data.ratingCount,
      });
      setRateMsg({
        type: "ok",
        text: `${t(lang, "recipe", "ratingThanks")} ★${data.ratingAvg.toFixed(
          2
        )} (${data.ratingCount})`,
      });
    } catch (e: any) {
      setRateMsg({
        type: "error",
        text: t(lang, "recipe", "ratingFailed"),
      });
    } finally {
      setRatingBusy(false);
    }
  }

  function RenderStarsForRecipe({
    avg,
    myRating,
    onRate,
    disabled,
  }: {
    avg: number;
    myRating: number;
    onRate: (value: number) => void;
    disabled: boolean;
  }) {
    const effective = myRating || avg; // když user hodnotil → plné hvězdy

    return (
      <View style={s.starsRow}>
        {[1, 2, 3, 4, 5].map((star) => {
          const diff = effective - (star - 1);
          // diff = kolik hvězdy zaplníme (0–1)

          let icon: MaterialIconName = "star-border";

          if (diff >= 1) {
            icon = "star"; // 100% plná
          } else if (diff >= 0.75) {
            icon = "star"; // stále plná
          } else if (diff >= 0.25) {
            icon = "star-half"; // půl hvězda
          } else {
            icon = "star-border"; // prázdná
          }

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
                style={disabled && { opacity: 0.4 }}
              />
            </Pressable>
          );
        })}
      </View>
    );
  }

  return (
    <View style={[s.wrapper, { backgroundColor: colors.background }]}>
      {/* Obsah */}
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
          {step.type === "text" && (
            <View
              style={[
                s.textStep,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            ></View>
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
          <Text style={[s.description, { color: colors.text }]}>
            {getStepDescription(step, lang)}
          </Text>

          {/* ⏱ Timer – zobrazí se jen když krok má timerSeconds */}
          {hasTimer && (
            <View style={[s.timerBox, { borderColor: colors.border }]}>
              <View style={[s.timerCircle, { borderColor: colors.text }]}>
                <Text style={[s.timerValue, { color: colors.text }]}>
                  {formatTime(displaySeconds)}
                </Text>
              </View>
              {justFinished && (
                <Text style={[s.timerFinishedLabel, { color: colors.danger }]}>
                  {" "}
                  {t(lang, "recipe", "timerDone")}
                </Text>
              )}
              <View style={s.timerRow}>
                <Pressable
                  style={[
                    s.timerBtn,
                    {
                      borderColor: colors.text,
                      backgroundColor: colors.card,
                    },
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
                    {
                      borderColor: colors.text,
                      backgroundColor: colors.card,
                    },
                  ]}
                  onPress={() => {
                    setIsRunning(false);
                    setStartedAt(null);
                    setAccumulated(0);
                    setJustFinished(false);
                    if (hasTimer) {
                      setRemaining(rawTimer);
                    } else {
                      setRemaining(null);
                    }
                  }}
                >
                  <Text style={[s.timerBtnText, { color: colors.pillActive }]}>
                    ■
                  </Text>
                </Pressable>
              </View>
            </View>
          )}
        </View>
        {/* ⭐ Rating jen na posledním kroku, nad tlačítky */}
        {current === steps.length - 1 && (
          <View style={s.ratingBox}>
            <Text style={[s.completedLabel, { color: colors.text }]}>
              {t(lang, "recipe", "completed")}
            </Text>
            <Text style={[s.ratingLabel, { color: colors.secondaryText }]}>
              {t(lang, "recipe", "rateThis")}
            </Text>
            <RenderStarsForRecipe
              avg={community.avg}
              myRating={myRating}
              onRate={(value) => submitRating(value)}
              disabled={!canRateCommunity || ratingBusy}
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
        {/* 🔽 Tlačítka dole – layout jako dřív */}
        <View style={s.row}>
          <Pressable
            disabled={current === 0}
            onPress={() => setCurrent((p) => Math.max(0, p - 1))}
            style={[
              s.btn,
              {
                borderColor: colors.border,
                backgroundColor: colors.border,
              },
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
const s = StyleSheet.create({
  wrapper: { flex: 1, backgroundColor: "#000" },

  card: {
    flex: 1,
    backgroundColor: "#211d1dff",
    padding: 16,
    paddingTop: 45,
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
  timerBox: {
    marginTop: 16,
    padding: 12,
  },
  timerLabel: {
    fontSize: 12,
    textTransform: "uppercase",
    opacity: 0.7,
    color: "#dcd7d7ff",
  },
  timerValue: {
    marginTop: 4,
    fontSize: 24,
    fontWeight: "800",
    letterSpacing: 2,
    color: "#ffffff",
  },
  timerRow: {
    flexDirection: "row",
    gap: 30,
    marginTop: 12,
    justifyContent: "center",
  },
  timerBtn: {
    borderRadius: 70,
    borderWidth: 0.5,
    borderColor: "#555",
    alignItems: "center",
    width: 50,
    height: 50,
  },
  timerBtnActive: {
    backgroundColor: "#111",
    borderColor: "#111",
  },
  timerBtnActiveText: {
    fontSize: 20,
    position: "relative",
    top: 10,
  },
  timerBtnText: {
    color: "#982929ff",
    fontSize: 33,
    position: "relative",
    bottom: 1,
  },
  timerCircle: {
    marginTop: 8,
    alignSelf: "center", // nebo "center", jestli ho chceš doprostřed
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: "#ffffff",
    alignItems: "center",
    justifyContent: "center",
  },
  timerFinishedLabel: {
    marginTop: 8,
    textAlign: "center",
    color: "#ff5555",
    fontWeight: "800",
  },
  ratingBox: {
    paddingHorizontal: 4,
    paddingVertical: 8,
    alignItems: "center",
  },
  completedLabel: {
    color: "#dcd7d7ff",
    fontWeight: "800",
    marginBottom: 4,
  },
  ratingLabel: {
    color: "#dcd7d7ff",
    marginBottom: 6,
  },
  starsRow: {
    flexDirection: "row",
    gap: 8,
    justifyContent: "center",
    marginBottom: 6,
  },
  starPressable: {
    padding: 2,
  },
  star: {
    fontSize: 28,
    color: "#555",
  },
  starFilled: {
    color: "#ffd700",
  },
  ratingMeta: {
    color: "#dcd7d7ff",
    fontSize: 12,
    marginTop: 2,
  },
  ratingMsg: {
    marginTop: 4,
    fontSize: 12,
    textAlign: "center",
  },
  ratingMsgOk: {
    color: "limegreen",
  },
  ratingMsgErr: {
    color: "tomato",
  },
  ratingDisabled: {
    marginTop: 4,
    fontSize: 12,
    color: "#aaaaaa",
    textAlign: "center",
  },
});

function useBlowToNextStep(
  enabled: boolean,
  onBlow: () => void,
  deps: any[] = []
) {
  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;
    let recording: Audio.Recording | null = null;
    let lastTrigger = 0;
    let baseline: number | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    let samples = 0;

    let hotCount = 0; // kolik „horkých“ vzorků máme za sebou
    let hotMin: number | null = null; // nejnižší amp v aktuálním „fouknutí“
    let hotMax: number | null = null; // nejvyšší amp v aktuálním „fouknutí“

    (async () => {
      try {
        const perm = await Audio.requestPermissionsAsync();
        if (!perm.granted) {
          if (__DEV__) console.log("[BLOW] Mic permission not granted");
          return;
        }

        try {
          await Audio.setAudioModeAsync({
            allowsRecordingIOS: true,
            playsInSilentModeIOS: true,
            staysActiveInBackground: false,
          });
        } catch (e) {
          if (__DEV__) console.log("[BLOW] setAudioMode failed", e);
        }

        const recordingOptions: Audio.RecordingOptions = {
          ...Audio.RecordingOptionsPresets.HIGH_QUALITY,
          isMeteringEnabled: true,
        };

        recording = new Audio.Recording();
        await recording.prepareToRecordAsync(recordingOptions);
        await recording.startAsync();

        if (__DEV__) console.log("[BLOW] Recording started");

        interval = setInterval(async () => {
          if (cancelled || !recording) return;

          let status: any;
          try {
            status = await recording.getStatusAsync();
          } catch (e) {
            if (__DEV__) console.log("[BLOW] getStatus error", e);
            return;
          }

          if (!status.isRecording) return;

          const amp =
            typeof status.metering === "number" ? status.metering : null;

          if (amp == null) {
            if (__DEV__) console.log("[BLOW] metering not available");
            return;
          }

          samples++;

          // 🧊 WARMUP – prvních pár vzorků jen ladíme baseline
          if (samples < 10) {
            if (baseline == null) {
              baseline = amp;
            } else {
              baseline = baseline * 0.8 + amp * 0.2;
            }

            if (__DEV__) {
              console.log("[BLOW] warmup amp", amp, "baseline", baseline);
            }
            return;
          }

          if (baseline == null) {
            baseline = amp;
            return;
          }

          // lehké vyhlazení
          baseline = baseline * 0.9 + amp * 0.1;
          const delta = amp - baseline;

          if (__DEV__) {
            console.log("[BLOW] amp", amp, "base", baseline, "delta", delta);
          }

          const now = Date.now();
          const COOL_DOWN = 2500; // trochu kratší, ať to není líné

          // 🎚 kompromisní prahy
          const MIN_DELTA = 28; // o něco méně přísné → fouknutí projde snáz
          const MIN_AMP = -32; // dovolíme fouknout o chlup dál od mikrofonu

          const isHot = delta > MIN_DELTA && amp > MIN_AMP;

          if (isHot) {
            // rozjíždíme / pokračujeme „fouknutí“
            hotCount++;
            if (hotMin == null || hotMax == null) {
              hotMin = amp;
              hotMax = amp;
            } else {
              hotMin = Math.min(hotMin, amp);
              hotMax = Math.max(hotMax, amp);
            }
          } else {
            // klid / normální zvuk → reset „fouknutí“
            hotCount = 0;
            hotMin = null;
            hotMax = null;
          }

          // fouknutí musí být delší shluk „horkých“ vzorků
          const REQUIRED_HOT_SAMPLES = 3; // zase o chlup citlivější než 4
          const MAX_HOT_VARIATION = 10; // povolíme větší kolísání při fouknut
          // hudba má větší výkyvy

          if (
            hotCount >= REQUIRED_HOT_SAMPLES &&
            hotMin != null &&
            hotMax != null &&
            hotMax - hotMin <= MAX_HOT_VARIATION &&
            now - lastTrigger > COOL_DOWN
          ) {
            lastTrigger = now;
            hotCount = 0;
            hotMin = null;
            hotMax = null;

            if (__DEV__) console.log("[BLOW] TRIGGER");
            onBlow();
          }
        }, 120);
      } catch (err) {
        if (__DEV__) console.log("[BLOW] detection failed:", err);
      }
    })();

    return () => {
      cancelled = true;

      if (interval) {
        clearInterval(interval);
        interval = null;
      }

      if (recording) {
        recording.stopAndUnloadAsync().catch((e) => {
          if (__DEV__) console.log("[BLOW] stop failed", e);
        });
        recording = null;
      }

      Audio.setAudioModeAsync({ allowsRecordingIOS: false }).catch(() => {});
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, onBlow, ...deps]);
}

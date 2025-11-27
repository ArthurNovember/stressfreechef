import { useLocalSearchParams, useRouter } from "expo-router";
import { useState, useEffect } from "react";
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

type Step = {
  type: "image" | "video" | "text";
  src?: string;
  description: string;
  timerSeconds?: number;
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
  useKeepAwake();
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
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [accumulated, setAccumulated] = useState(0);
  const [justFinished, setJustFinished] = useState(false);
  const steps = recipe?.steps || [];

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

  const formatTime = (totalSeconds: number) => {
    const safe = Math.max(0, Math.floor(totalSeconds || 0));
    const minutes = Math.floor(safe / 60);
    const seconds = safe % 60;
    const mm = String(minutes).padStart(2, "0");
    const ss = String(seconds).padStart(2, "0");
    return `${mm}:${ss}`;
  };

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

  const rawTimer =
    typeof step.timerSeconds === "number"
      ? step.timerSeconds
      : Number(step.timerSeconds ?? 0);

  // Timer bereme jen pokud je > 0 (0 = vlastně žádný timer)
  const hasTimer = rawTimer > 0;

  const displaySeconds =
    remaining != null ? remaining : hasTimer ? rawTimer : 0;

  const handleStartPause = () => {
    if (!hasTimer) return;

    // 👉 START
    if (!isRunning) {
      setJustFinished(false);

      // pokud jsme na nule (timer doběhl nebo byl nějak rozbitý), začínáme znova
      if (remaining == null || remaining <= 0) {
        setAccumulated(0);
        if (rawTimer > 0) {
          setRemaining(rawTimer);
        }
      }

      setStartedAt(Date.now());
      setIsRunning(true);
      return;
    }

    // 👉 PAUSE
    if (startedAt != null) {
      const elapsedSinceStart = (Date.now() - startedAt) / 1000;
      setAccumulated((acc) => acc + elapsedSinceStart);
    }
    setStartedAt(null);
    setIsRunning(false);
  };

  const vibrateTimerDone = () => {
    if (Platform.OS === "android") {
      // 3 krátké pulzy: bzz – pauza – bzz – pauza – bzz
      Vibration.vibrate([0, 300, 150, 300, 150, 300]);
    } else {
      // iOS stejně dělá jen default vibraci
      Vibration.vibrate();
    }
  };

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
          {/* ⏱ Timer – zobrazí se jen když krok má timerSeconds */}
          {hasTimer && (
            <View style={s.timerBox}>
              <View style={s.timerCircle}>
                <Text style={s.timerValue}>{formatTime(displaySeconds)}</Text>
              </View>

              {justFinished && (
                <Text style={s.timerFinishedLabel}>Timer completed ✔</Text>
              )}

              <View style={s.timerRow}>
                <Pressable style={s.timerBtn} onPress={handleStartPause}>
                  <Text
                    style={[s.timerBtnText, isRunning && s.timerBtnActiveText]}
                  >
                    {isRunning ? "❚❚" : "▶"}
                  </Text>
                </Pressable>

                <Pressable
                  style={s.timerBtn}
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
                  <Text style={s.timerBtnText}>■</Text>
                </Pressable>
              </View>
            </View>
          )}
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
    borderWidth: StyleSheet.hairlineWidth,
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
});

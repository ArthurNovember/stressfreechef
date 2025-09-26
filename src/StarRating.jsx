import { useState } from "react";

export default function StarRating({
  value = 0, // může být 4.7 → částečné vyplnění
  onRate, // pokud dáš, je interaktivní (klik = celé 1..5)
  readOnly = false,
  size = 22,
  showValue = false,
  count,
}) {
  const [hover, setHover] = useState(null);
  const base = Math.max(0, Math.min(5, hover ?? value));

  const handleClick = (i) => {
    if (readOnly || !onRate) return;
    onRate(i + 1); // celé hvězdy
  };

  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <div role="img" aria-label={`${base.toFixed(1)} out of 5`}>
        {[0, 1, 2, 3, 4].map((i) => {
          const diff = base - i;
          const fill = Math.max(0, Math.min(1, diff)); // 0..1
          return (
            <span
              key={i}
              onClick={() => handleClick(i)}
              onMouseEnter={() => !readOnly && onRate && setHover(i + 1)}
              onMouseLeave={() => setHover(null)}
              style={{
                position: "relative",
                display: "inline-block",
                width: size,
                height: size,
                cursor: readOnly || !onRate ? "default" : "pointer",
                lineHeight: `${size}px`,
                fontSize: size,
                marginRight: 2,
                userSelect: "none",
              }}
              aria-label={`${i + 1} star`}
              title={readOnly ? undefined : `${i + 1} stars`}
            >
              {/* prázdná */}
              <span
                style={{ position: "absolute", inset: 0, color: "#bcbcbc" }}
              >
                ★
              </span>
              {/* vyplněná část */}
              <span
                style={{
                  position: "absolute",
                  inset: 0,
                  width: `${fill * 100}%`,
                  overflow: "hidden",
                  color: "gold",
                }}
              >
                ★
              </span>
            </span>
          );
        })}
      </div>
      {showValue && (
        <span style={{ fontSize: Math.round(size * 0.6) }}>
          {base.toFixed(1)}
          {typeof count === "number" ? ` (${count})` : ""}
        </span>
      )}
    </div>
  );
}

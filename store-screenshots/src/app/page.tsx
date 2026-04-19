"use client";
import { toPng } from "html-to-image";

// ── Design Tokens ─────────────────────────────────────────────────────────────
const CYAN = "#00e5ff";
const MAGENTA = "#ff3860";
const NAVY = "#0a0a2e";
const NAVY2 = "#0d1b4b";
const PURPLE = "#1a0a3e";

// iPhone 6.5" App Store screenshot: 1284x2778 at pixelRatio
const FRAME_W = 428;
const FRAME_H = 926;

// ── Star Field ────────────────────────────────────────────────────────────────
function StarField() {
  const stars = Array.from({ length: 30 }, (_, i) => ({
    id: i,
    x: (i * 137.5) % 100,
    y: (i * 73.1) % 100,
    size: (i % 3) + 1,
    op: 0.2 + (i % 5) * 0.1,
  }));
  return (
    <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
      {stars.map(s => (
        <div key={s.id} style={{
          position: "absolute",
          left: `${s.x}%`,
          top: `${s.y}%`,
          width: s.size,
          height: s.size,
          borderRadius: "50%",
          background: "#fff",
          opacity: s.op,
        }} />
      ))}
    </div>
  );
}

// ── Phone Mockup ──────────────────────────────────────────────────────────────
function PhoneMockup({ screenshot }: { screenshot: string }) {
  const w = FRAME_W * 0.68;
  const h = FRAME_H * 0.62;
  return (
    <div style={{
      position: "relative", width: w, height: h,
      borderRadius: 32, overflow: "hidden",
      border: "4px solid #3a3a3a",
      boxShadow: "0 0 0 1px #555, 0 8px 32px rgba(0,0,0,0.6)",
      background: "#000",
    }}>
      <img src={screenshot} alt="" style={{
        width: "100%", height: "100%",
        objectFit: "cover",
      }} />
      {/* Dynamic Island */}
      <div style={{
        position: "absolute", top: 8, left: "50%", transform: "translateX(-50%)",
        width: 72, height: 20, borderRadius: 12,
        background: "#000",
      }} />
    </div>
  );
}

// ── Slide ─────────────────────────────────────────────────────────────────────
interface SlideProps {
  id: string;
  tag?: string;
  headline: string;
  subline: string;
  screenshot: string;
  accent?: string;
  bg?: string;
}

function Slide({ id, tag, headline, subline, screenshot, accent = CYAN, bg }: SlideProps) {
  const background = bg ?? `radial-gradient(ellipse at 35% 15%, ${NAVY2} 0%, ${NAVY} 58%, ${PURPLE} 100%)`;
  return (
    <div id={id} style={{
      width: FRAME_W, height: FRAME_H,
      background,
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "space-between",
      padding: "52px 24px 44px",
      position: "relative", overflow: "hidden",
      fontFamily: "'Courier New', Courier, monospace",
      flexShrink: 0,
    }}>
      <StarField />

      {/* Glow orb */}
      <div style={{
        position: "absolute", bottom: "22%", left: "50%",
        transform: "translateX(-50%)",
        width: 320, height: 320,
        background: `radial-gradient(circle, ${accent}1a 0%, transparent 70%)`,
        pointerEvents: "none",
      }} />

      {/* Top copy */}
      <div style={{ textAlign: "center", zIndex: 1 }}>
        {tag && (
          <div style={{
            display: "inline-block",
            background: `${accent}20`,
            border: `1px solid ${accent}55`,
            borderRadius: 20, padding: "4px 14px",
            color: accent, fontSize: 11, letterSpacing: 2,
            fontWeight: 700, textTransform: "uppercase", marginBottom: 14,
          }}>{tag}</div>
        )}
        <h1 style={{
          color: "#fff", fontSize: 34, fontWeight: 900,
          lineHeight: 1.2, margin: 0,
          textShadow: `0 0 40px ${accent}55`,
          whiteSpace: "pre-line",
        }}>{headline}</h1>
        <p style={{
          color: accent, fontSize: 14, fontWeight: 600,
          marginTop: 10, letterSpacing: 0.3, lineHeight: 1.5,
        }}>{subline}</p>
      </div>

      {/* Phone */}
      <div style={{ zIndex: 2 }}>
        <PhoneMockup screenshot={screenshot} />
      </div>
    </div>
  );
}

// ── Slides Data ───────────────────────────────────────────────────────────────
const SLIDES: SlideProps[] = [
  {
    id: "slide-1", tag: "Gravity Runner",
    headline: "Tap to Jump\nSwipe to Flip",
    subline: "Simple controls, infinite challenge",
    screenshot: "/screenshots/gameplay.jpg",
    accent: CYAN,
    bg: `radial-gradient(ellipse at 40% 10%, #0d2060 0%, ${NAVY} 55%, #180535 100%)`,
  },
  {
    id: "slide-2", tag: "Boss Battle",
    headline: "Face the\nBoss",
    subline: "Survive epic boss encounters",
    screenshot: "/screenshots/boss.jpg",
    accent: MAGENTA,
    bg: `radial-gradient(ellipse at 30% 20%, #3d0020 0%, ${NAVY} 60%, #0a0a30 100%)`,
  },
  {
    id: "slide-3", tag: "Characters",
    headline: "Choose Your\nCharacter",
    subline: "Unlock 20+ skins, eyes & effects",
    screenshot: "/screenshots/home-en.jpg",
    accent: "#a855f7",
    bg: `radial-gradient(ellipse at 60% 10%, #2d0a5e 0%, ${NAVY} 60%, #0a1540 100%)`,
  },
  {
    id: "slide-4", tag: "Rankings",
    headline: "Compete Globally",
    subline: "Chase the top score, rise in the rankings",
    screenshot: "/screenshots/ranking-en.jpg",
    accent: "#ffd700",
    bg: `radial-gradient(ellipse at 70% 20%, #001a3d 0%, ${NAVY} 60%, #1a0030 100%)`,
  },
];

const SLIDES_JA: SlideProps[] = [
  {
    id: "slide-ja-1", tag: "重力アクション",
    headline: "タップでジャンプ\nスワイプで上下反転",
    subline: "簡単操作で無限の挑戦",
    screenshot: "/screenshots/gameplay.jpg",
    accent: CYAN,
    bg: `radial-gradient(ellipse at 40% 10%, #0d2060 0%, ${NAVY} 55%, #180535 100%)`,
  },
  {
    id: "slide-ja-2", tag: "ボス戦",
    headline: "ボスに\n立ち向かえ",
    subline: "白熱のボスバトルを生き残れ",
    screenshot: "/screenshots/boss.jpg",
    accent: MAGENTA,
    bg: `radial-gradient(ellipse at 30% 20%, #3d0020 0%, ${NAVY} 60%, #0a0a30 100%)`,
  },
  {
    id: "slide-ja-3", tag: "キャラクター",
    headline: "キャラクターを\n選ぼう",
    subline: "20種以上のスキン・目・エフェクトを解放",
    screenshot: "/screenshots/home.jpg",
    accent: "#a855f7",
    bg: `radial-gradient(ellipse at 60% 10%, #2d0a5e 0%, ${NAVY} 60%, #0a1540 100%)`,
  },
  {
    id: "slide-ja-4", tag: "ランキング",
    headline: "世界と競え",
    subline: "トップスコアを目指せ、ランキングを駆け上がれ",
    screenshot: "/screenshots/ranking.jpg",
    accent: "#ffd700",
    bg: `radial-gradient(ellipse at 70% 20%, #001a3d 0%, ${NAVY} 60%, #1a0030 100%)`,
  },
];

// ── Export ────────────────────────────────────────────────────────────────────
async function exportSlide(id: string) {
  const el = document.getElementById(id);
  if (!el) return;
  const dataUrl = await toPng(el, { pixelRatio: 1284 / 428 });
  const a = document.createElement("a");
  a.download = `${id}.png`;
  a.href = dataUrl;
  a.click();
}

async function exportAll() {
  for (const s of SLIDES) {
    await exportSlide(s.id);
    await new Promise(r => setTimeout(r, 400));
  }
}

async function exportAllJa() {
  for (const s of SLIDES_JA) {
    await exportSlide(s.id);
    await new Promise(r => setTimeout(r, 400));
  }
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function Page() {
  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", padding: 32 }}>
      <div style={{ marginBottom: 28, fontFamily: "monospace" }}>
        <h1 style={{ color: CYAN, fontSize: 22, fontWeight: 700, margin: 0 }}>
          Grav Hopper — App Store Screenshots
        </h1>
        <p style={{ color: "#666", marginTop: 4, fontSize: 13 }}>
          4 slides · iPhone 6.5" · Export → 1284×2778 px
        </p>
        <button onClick={exportAll} style={{
          marginTop: 12, background: CYAN, color: NAVY,
          border: "none", borderRadius: 8, padding: "10px 24px",
          fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "monospace",
        }}>
          ⬇ Export All (PNG @3x)
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 28 }}>
        {SLIDES.map((slide, i) => (
          <div key={slide.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#555", fontSize: 12, fontFamily: "monospace" }}>EN Slide {i + 1}</span>
            <Slide {...slide} />
            <button onClick={() => exportSlide(slide.id)} style={{
              background: "#111", color: CYAN,
              border: `1px solid ${CYAN}44`, borderRadius: 6,
              padding: "6px 16px", fontSize: 12, cursor: "pointer", fontFamily: "monospace",
            }}>
              Export PNG
            </button>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 48, marginBottom: 28, fontFamily: "monospace" }}>
        <h2 style={{ color: "#ffd700", fontSize: 20, fontWeight: 700, margin: 0 }}>
          日本語版
        </h2>
        <button onClick={exportAllJa} style={{
          marginTop: 12, background: "#ffd700", color: NAVY,
          border: "none", borderRadius: 8, padding: "10px 24px",
          fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "monospace",
        }}>
          ⬇ Export All JA (PNG @3x)
        </button>
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 28 }}>
        {SLIDES_JA.map((slide, i) => (
          <div key={slide.id} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
            <span style={{ color: "#555", fontSize: 12, fontFamily: "monospace" }}>JA Slide {i + 1}</span>
            <Slide {...slide} />
            <button onClick={() => exportSlide(slide.id)} style={{
              background: "#111", color: "#ffd700",
              border: `1px solid #ffd70044`, borderRadius: 6,
              padding: "6px 16px", fontSize: 12, cursor: "pointer", fontFamily: "monospace",
            }}>
              Export PNG
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

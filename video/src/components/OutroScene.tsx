import {
  AbsoluteFill,
  Img,
  interpolate,
  spring,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "../constants";
import { fontFamily } from "../fonts";

export const OutroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({
    frame,
    fps,
    config: { damping: 20, stiffness: 140 },
  });

  const titleOpacity = interpolate(enter, [0, 1], [0, 1]);
  const titleY = interpolate(enter, [0, 1], [36, 0]);

  const ctaOpacity = interpolate(
    frame,
    [0.8 * fps, 1.6 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#050508",
        fontFamily,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Img
        src={staticFile("onboarding/background.webp")}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.18,
        }}
      />

      <div
        style={{
          position: "absolute",
          width: 640,
          height: 640,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${BRAND.accentSoft} 0%, transparent 72%)`,
          opacity: 0.7,
          filter: "blur(48px)",
        }}
      />

      <div
        style={{
          zIndex: 1,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 24,
          opacity: titleOpacity,
          transform: `translateY(${titleY}px)`,
        }}
      >
        <Img
          src={staticFile("sozucapital_logo_tb.png")}
          style={{
            width: 220,
            height: "auto",
            objectFit: "contain",
          }}
        />

        <div
          style={{
            color: "#ffffff",
            fontSize: 44,
            fontWeight: 700,
            letterSpacing: -0.8,
            textAlign: "center",
            maxWidth: 760,
            lineHeight: 1.15,
          }}
        >
          {BRAND.cta}
        </div>

        <div
          style={{
            opacity: ctaOpacity,
            marginTop: 8,
            padding: "16px 32px",
            borderRadius: 999,
            background: BRAND.accent,
            color: "#ffffff",
            fontSize: 28,
            fontWeight: 600,
            letterSpacing: 0.4,
          }}
        >
          {BRAND.url}
        </div>
      </div>
    </AbsoluteFill>
  );
};

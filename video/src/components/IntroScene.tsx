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

export const IntroScene: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const logoSpring = spring({
    frame,
    fps,
    config: { damping: 18, stiffness: 120, mass: 0.9 },
  });

  const logoScale = interpolate(logoSpring, [0, 1], [0.72, 1]);
  const logoOpacity = interpolate(frame, [0, 0.4 * fps], [0, 1], {
    extrapolateRight: "clamp",
  });

  const taglineOpacity = interpolate(
    frame,
    [0.6 * fps, 1.4 * fps],
    [0, 1],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );
  const taglineY = interpolate(
    frame,
    [0.6 * fps, 1.4 * fps],
    [24, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  const glowOpacity = interpolate(
    frame,
    [0, 1.5 * fps, 3 * fps],
    [0, 0.55, 0.35],
    { extrapolateRight: "clamp" },
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
      <div
        style={{
          position: "absolute",
          width: 520,
          height: 520,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${BRAND.accentSoft} 0%, transparent 70%)`,
          opacity: glowOpacity,
          filter: "blur(40px)",
        }}
      />

      <Img
        src={staticFile("onboarding/background.webp")}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.12,
        }}
      />

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 28,
          zIndex: 1,
        }}
      >
        <Img
          src={staticFile("icons/sozu_icon_512.png")}
          style={{
            width: 128,
            height: 128,
            borderRadius: 28,
            transform: `scale(${logoScale})`,
            opacity: logoOpacity,
            boxShadow: "0 24px 80px rgba(99, 102, 241, 0.35)",
          }}
        />

        <div
          style={{
            opacity: taglineOpacity,
            transform: `translateY(${taglineY}px)`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              color: "#ffffff",
              fontSize: 52,
              fontWeight: 700,
              letterSpacing: -1.2,
              lineHeight: 1.1,
            }}
          >
            Sozu Credit
          </div>
          <div
            style={{
              marginTop: 16,
              color: "rgba(255,255,255,0.72)",
              fontSize: 28,
              fontWeight: 400,
              letterSpacing: 0.2,
            }}
          >
            {BRAND.tagline}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

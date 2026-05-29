import {
  AbsoluteFill,
  Img,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BRAND } from "../constants";
import { fontFamily } from "../fonts";

type SlideSceneProps = {
  src: string;
  caption: string;
};

export const SlideScene: React.FC<SlideSceneProps> = ({ src, caption }) => {
  const frame = useCurrentFrame();
  const { durationInFrames, fps } = useVideoConfig();

  const kenBurns = interpolate(frame, [0, durationInFrames], [1, 1.04], {
    extrapolateRight: "clamp",
  });
  const driftY = interpolate(frame, [0, durationInFrames], [0, -18], {
    extrapolateRight: "clamp",
  });

  const captionOpacity = interpolate(
    frame,
    [0.35 * fps, 1 * fps, durationInFrames - 0.8 * fps, durationInFrames - 0.2 * fps],
    [0, 1, 1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" },
  );

  return (
    <AbsoluteFill style={{ backgroundColor: "#050508", fontFamily }}>
      <Img
        src={staticFile("onboarding/background.webp")}
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          opacity: 0.35,
          filter: "blur(2px)",
        }}
      />

      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "48px 36px 120px",
        }}
      >
        <div
          style={{
            flex: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            maxWidth: 920,
          }}
        >
          <div
            style={{
              width: "100%",
              borderRadius: 36,
              overflow: "hidden",
              boxShadow: "0 40px 120px rgba(0,0,0,0.55)",
              border: "1px solid rgba(255,255,255,0.08)",
              transform: `scale(${kenBurns}) translateY(${driftY}px)`,
            }}
          >
            <Img
              src={staticFile(src)}
              style={{
                width: "100%",
                height: "auto",
                display: "block",
              }}
            />
          </div>
        </div>

        <div
          style={{
            position: "absolute",
            bottom: 72,
            left: 48,
            right: 48,
            opacity: captionOpacity,
            textAlign: "center",
          }}
        >
          <div
            style={{
              display: "inline-block",
              padding: "14px 28px",
              borderRadius: 999,
              background: "rgba(0,0,0,0.55)",
              border: `1px solid ${BRAND.accentSoft}`,
              backdropFilter: "blur(12px)",
              color: "#ffffff",
              fontSize: 26,
              fontWeight: 600,
              letterSpacing: -0.2,
            }}
          >
            {caption}
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

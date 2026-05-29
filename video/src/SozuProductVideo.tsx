import { AbsoluteFill } from "remotion";
import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import { staticFile } from "remotion";
import { IntroScene } from "./components/IntroScene";
import { OutroScene } from "./components/OutroScene";
import { SlideScene } from "./components/SlideScene";
import { SCENE, SLIDE_CAPTIONS, SLIDES } from "./constants";

const transitionTiming = linearTiming({ durationInFrames: SCENE.transition });

export const SozuProductVideo: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: "#050508" }}>
      <Audio
        src={staticFile("sound/KREAEM_percussion_one_shot_falling_wood.wav")}
        volume={0.18}
      />

      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={SCENE.intro}>
          <IntroScene />
        </TransitionSeries.Sequence>

        <TransitionSeries.Transition
          presentation={fade()}
          timing={transitionTiming}
        />

        {SLIDES.flatMap((slideSrc, index) => {
          const isLastSlide = index === SLIDES.length - 1;

          return [
            <TransitionSeries.Sequence
              key={slideSrc}
              durationInFrames={SCENE.slide}
            >
              <SlideScene src={slideSrc} caption={SLIDE_CAPTIONS[index]} />
            </TransitionSeries.Sequence>,
            <TransitionSeries.Transition
              key={`${slideSrc}-transition`}
              presentation={
                isLastSlide ? fade() : slide({ direction: "from-bottom" })
              }
              timing={transitionTiming}
            />,
          ];
        })}

        <TransitionSeries.Sequence durationInFrames={SCENE.outro}>
          <OutroScene />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
};

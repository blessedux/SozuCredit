import "./index.css";
import { Composition } from "remotion";
import { SozuProductVideo } from "./SozuProductVideo";
import { FPS, VERTICAL_DURATION } from "./constants";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="SozuProductVideo"
        component={SozuProductVideo}
        durationInFrames={VERTICAL_DURATION}
        fps={FPS}
        width={1080}
        height={1920}
      />
    </>
  );
};

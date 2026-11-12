import "./font";
import { Composition } from "remotion";
import { VoraPromo } from "./VoraPromo";

export const RemotionRoot: React.FC = () => (
  <>
    <Composition id="VoraPromo" component={VoraPromo} durationInFrames={1980} fps={30} width={1080} height={1920} defaultProps={{ variant: "full" as const }} />
    <Composition id="VoraPromoGBP" component={VoraPromo} durationInFrames={1794} fps={30} width={1080} height={1920} defaultProps={{ variant: "gbp" as const }} />
  </>
);

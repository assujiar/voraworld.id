import "./font";
import { Composition } from "remotion";
import { VoraPromo } from "./VoraPromo";

export const RemotionRoot: React.FC = () => (
  <Composition id="VoraPromo" component={VoraPromo} durationInFrames={1860} fps={30} width={1080} height={1920} />
);

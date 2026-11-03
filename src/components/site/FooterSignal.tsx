'use client'
import { Player } from '@remotion/player'
import { interpolate, useCurrentFrame } from 'remotion'
function HandoverSignal() {
  const frame=useCurrentFrame(), progress=interpolate(frame,[0,80],[0,1],{extrapolateLeft:'clamp',extrapolateRight:'clamp'})
  return <svg width="100%" height="100%" viewBox="0 0 500 14"><path d="M4 7H496" stroke="#ffffff26" strokeWidth="2"/><path d="M4 7H496" pathLength="1" stroke="#B43E31" strokeWidth="2" strokeDasharray="1" strokeDashoffset={1-progress}/>{[4,250,496].map((x,i)=><circle key={x} cx={x} cy="7" r="4" fill={progress>=i/2?'#fff':'#65727c'}/>)}</svg>
}
/** Bounded Remotion sequence, mounted with the footer and settled after three seconds. */
export default function FooterSignal(){return <Player component={HandoverSignal} durationInFrames={90} fps={30} compositionWidth={500} compositionHeight={14} autoPlay loop={false} controls={false} clickToPlay={false} doubleClickToFullscreen={false} spaceKeyToPlayOrPause={false} numberOfSharedAudioTags={0} acknowledgeRemotionLicense style={{width:'100%',height:'100%'}}/>}

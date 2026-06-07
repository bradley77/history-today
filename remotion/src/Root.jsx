import { Composition } from 'remotion';
import { ArticleVideo } from './ArticleVideo';
import { totalDuration } from './data/config';
import KorematsuVideo from './videos/KorematsuVideo';
import HissVideo from './videos/HissVideo';
import MadisonVideo from './videos/MadisonVideo';
import McVeighVideo from './videos/McVeighVideo';
import GettysburgVideo from './videos/GettysburgVideo';
import ClarkVideo from './videos/ClarkVideo';
import SnowdenVideo from './videos/SnowdenVideo';
import EisenhowerVideo from './videos/EisenhowerVideo';
import { totalDuration as snowdenDuration } from './data/snowden';
import { totalDuration as eisenhowerDuration } from './data/eisenhower';
import { DDayMap } from './compositions/DDayMap';
import { totalDuration as korematsuDuration, FPS } from './data/korematsu';
import { totalDuration as gettysburgDuration } from './data/gettysburg';
import { totalDuration as clarkDuration } from './data/clark';

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="ArticleVideo"
        component={ArticleVideo}
        durationInFrames={totalDuration}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="KorematsuVideo"
        component={KorematsuVideo}
        durationInFrames={korematsuDuration}
        fps={FPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="HissVideo"
        component={HissVideo}
        durationInFrames={1260}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="MadisonVideo"
        component={MadisonVideo}
        durationInFrames={1215}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="McVeighVideo"
        component={McVeighVideo}
        durationInFrames={1347}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="GettysburgVideo"
        component={GettysburgVideo}
        durationInFrames={gettysburgDuration}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="ClarkVideo"
        component={ClarkVideo}
        durationInFrames={clarkDuration}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="SnowdenVideo"
        component={SnowdenVideo}
        durationInFrames={snowdenDuration}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="EisenhowerVideo"
        component={EisenhowerVideo}
        durationInFrames={eisenhowerDuration}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="DDayMap"
        component={DDayMap}
        durationInFrames={540}
        fps={30}
        width={1080}
        height={1920}
      />
    </>
  );
};

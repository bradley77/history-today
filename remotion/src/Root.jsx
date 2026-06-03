import { Composition } from 'remotion';
import { ArticleVideo } from './ArticleVideo';
import { totalDuration } from './data/config';
import KorematsuVideo from './videos/KorematsuVideo';
import HissVideo from './videos/HissVideo';
import MadisonVideo from './videos/MadisonVideo';
import McVeighVideo from './videos/McVeighVideo';
import { totalDuration as korematsuDuration, FPS } from './data/korematsu';

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
    </>
  );
};

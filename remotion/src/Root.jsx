import { Composition } from 'remotion';
import { ArticleVideo } from './ArticleVideo';
import { totalDuration } from './data/config';

export const RemotionRoot = () => {
  return (
    <Composition
      id="ArticleVideo"
      component={ArticleVideo}
      durationInFrames={totalDuration}
      fps={30}
      width={1080}
      height={1920}
    />
  );
};

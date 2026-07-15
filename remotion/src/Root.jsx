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
import MidwayVideo from './videos/MidwayVideo';
import JamesEarlRayVideo from './videos/JamesEarlRayVideo';
import NorthwoodsVideo from './videos/NorthwoodsVideo';
import WarrenBunkerHillVideo, { totalDuration as warrenBunkerHillDuration } from './WarrenBunkerHill';
import { WatergateVideo } from './WatergateVideo';
import { watergateTotalDuration } from './data/watergate';
import StuartRide, { totalDuration as stuartRideDuration, FPS as stuartRideFPS } from './compositions/StuartRide';
import DraftLotteryVideo, { totalDuration as draftLotteryDuration, FPS as draftLotteryFPS } from './compositions/DraftLotteryVideo';
import PattonBloodAndGuts, { totalDuration as pattonBloodAndGutsDuration, FPS as pattonBloodAndGutsFPS } from './compositions/PattonBloodAndGuts';
import MyLaiVideo, { totalDuration as myLaiDuration, FPS as myLaiFPS } from './videos/MyLaiVideo';
import CIAHeartAttackGun, { totalDuration as ciaTotal, FPS as ciaFPS } from './compositions/CIAHeartAttackGun';
import LincolnFortStevens, { totalDuration as lfsTotal, FPS as lfsFPS } from './compositions/LincolnFortStevens';
import TokyoFirebombing, { totalDuration as tokyoTotalDuration, FPS as tokyoFPS } from './compositions/TokyoFirebombing';
import KheSanhQuickStrike, { totalDuration as kheSanhTotal, FPS as kheSanhFPS } from './compositions/KheSanhQuickStrike';
import MacArthurInchon, { totalDuration as macArthurInchonTotal, FPS as macArthurInchonFPS } from './compositions/MacArthurInchon';
import UnionShermanScorchedEarth, { totalDuration as unionShermanTotal, FPS as unionShermanFPS } from './compositions/UnionShermanScorchedEarth';
import GettysburgDay1QS, { totalDuration as gettysburgDay1QSTotal, FPS as gettysburgDay1QSFPS } from './compositions/GettysburgDay1QS';
import GettysburgDay2QS, { totalDuration as gettysburgDay2QSTotal, FPS as gettysburgDay2QSFPS } from './compositions/GettysburgDay2QS';
import GettysburgDay3QS, { totalDuration as gettysburgDay3QSTotal, FPS as gettysburgDay3QSFPS } from './compositions/GettysburgDay3QS';
import NuclearKyoto, { totalDuration as nuclearKyotoTotal, FPS as nuclearKyotoFPS } from './compositions/NuclearKyoto';
import BattleOfHue, { totalDuration as battleOfHueTotal, FPS as battleOfHueFPS } from './compositions/BattleOfHue';
import HighwayOfDeathQuickStrike, { totalDuration as highwayOfDeathTotal, FPS as highwayOfDeathFPS } from './compositions/HighwayOfDeathQuickStrike';
import VicksburgMineQS, { totalDuration as vicksburgMineQSTotal, FPS as vicksburgMineQSFPS } from './compositions/VicksburgMineQS';
import LeeResignationQS, { totalDuration as leeResignationQSTotal, FPS as leeResignationQSFPS } from './compositions/LeeResignationQS';
import BataanDeathMarchToll, { totalDuration as bataanDeathMarchTollTotal, FPS as bataanDeathMarchTollFPS } from './compositions/BataanDeathMarchToll';
import OperationFrequentWindQS, { totalDuration as operationFrequentWindQSTotal, FPS as operationFrequentWindQSFPS } from './compositions/OperationFrequentWindQS';
import GettysburgRetreatQS, { totalDuration as gettysburgRetreatQSTotal, FPS as gettysburgRetreatQSFPS } from './compositions/GettysburgRetreatQS';
import { totalDuration as snowdenDuration } from './data/snowden';
import { totalDuration as eisenhowerDuration } from './data/eisenhower';
import { totalDuration as midwayDuration } from './data/midway';
import { DDayMap } from './compositions/DDayMap';
import { totalDuration as korematsuDuration, FPS } from './data/korematsu';
import { totalDuration as gettysburgDuration } from './data/gettysburg';
import { totalDuration as clarkDuration } from './data/clark';
import { totalDuration as jamesEarlRayDuration } from './data/jamesEarlRay';
import { totalDuration as northwoodsDuration } from './data/northwoods';

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
        id="MidwayVideo"
        component={MidwayVideo}
        durationInFrames={midwayDuration}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="JamesEarlRayVideo"
        component={JamesEarlRayVideo}
        durationInFrames={jamesEarlRayDuration}
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
      <Composition
        id="NorthwoodsVideo"
        component={NorthwoodsVideo}
        durationInFrames={northwoodsDuration}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="StuartRide"
        component={StuartRide}
        durationInFrames={stuartRideDuration}
        fps={stuartRideFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="DraftLotteryVideo"
        component={DraftLotteryVideo}
        durationInFrames={draftLotteryDuration}
        fps={draftLotteryFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="WarrenBunkerHill"
        component={WarrenBunkerHillVideo}
        durationInFrames={warrenBunkerHillDuration}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="WatergateVideo"
        component={WatergateVideo}
        durationInFrames={watergateTotalDuration}
        fps={30}
        width={1080}
        height={1920}
      />
      <Composition
        id="PattonBloodAndGuts"
        component={PattonBloodAndGuts}
        durationInFrames={pattonBloodAndGutsDuration}
        fps={pattonBloodAndGutsFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="CIAHeartAttackGun"
        component={CIAHeartAttackGun}
        durationInFrames={ciaTotal}
        fps={ciaFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="LincolnFortStevens"
        component={LincolnFortStevens}
        durationInFrames={lfsTotal}
        fps={lfsFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="MyLaiVideo"
        component={MyLaiVideo}
        durationInFrames={myLaiDuration}
        fps={myLaiFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="TokyoFirebombing"
        component={TokyoFirebombing}
        durationInFrames={tokyoTotalDuration}
        fps={tokyoFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="KheSanhQuickStrike"
        component={KheSanhQuickStrike}
        durationInFrames={kheSanhTotal}
        fps={kheSanhFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="MacArthurInchon"
        component={MacArthurInchon}
        durationInFrames={macArthurInchonTotal}
        fps={macArthurInchonFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="UnionShermanScorchedEarth"
        component={UnionShermanScorchedEarth}
        durationInFrames={unionShermanTotal}
        fps={unionShermanFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="GettysburgDay1QS"
        component={GettysburgDay1QS}
        durationInFrames={gettysburgDay1QSTotal}
        fps={gettysburgDay1QSFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="GettysburgDay2QS"
        component={GettysburgDay2QS}
        durationInFrames={gettysburgDay2QSTotal}
        fps={gettysburgDay2QSFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="GettysburgDay3QS"
        component={GettysburgDay3QS}
        durationInFrames={gettysburgDay3QSTotal}
        fps={gettysburgDay3QSFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="NuclearKyoto"
        component={NuclearKyoto}
        durationInFrames={nuclearKyotoTotal}
        fps={nuclearKyotoFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="BattleOfHue"
        component={BattleOfHue}
        durationInFrames={battleOfHueTotal}
        fps={battleOfHueFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="HighwayOfDeathQuickStrike"
        component={HighwayOfDeathQuickStrike}
        durationInFrames={highwayOfDeathTotal}
        fps={highwayOfDeathFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="VicksburgMineQS"
        component={VicksburgMineQS}
        durationInFrames={vicksburgMineQSTotal}
        fps={vicksburgMineQSFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="LeeResignationQS"
        component={LeeResignationQS}
        durationInFrames={leeResignationQSTotal}
        fps={leeResignationQSFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="BataanDeathMarchToll"
        component={BataanDeathMarchToll}
        durationInFrames={bataanDeathMarchTollTotal}
        fps={bataanDeathMarchTollFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="OperationFrequentWindQS"
        component={OperationFrequentWindQS}
        durationInFrames={operationFrequentWindQSTotal}
        fps={operationFrequentWindQSFPS}
        width={1080}
        height={1920}
      />
      <Composition
        id="GettysburgRetreatQS"
        component={GettysburgRetreatQS}
        durationInFrames={gettysburgRetreatQSTotal}
        fps={gettysburgRetreatQSFPS}
        width={1080}
        height={1920}
      />
    </>
  );
};

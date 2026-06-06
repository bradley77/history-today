import { useCurrentFrame, Img, interpolate, staticFile } from 'remotion';
import { AnimatedRoute } from '../components/AnimatedRoute';
import { MapMarker } from '../components/MapMarker';
import { StatCallout } from '../components/StatCallout';
import { DDAYDATA } from '../data/dday-coordinates';
import { debugCoordinates } from '../utils/mapProjection';

const WIDE_MAP = { center: [-1.2, 50.1], zoom: 8.5, width: 1216, height: 1920 };

const TIMING = {
  titleIn: 0,
  airborneStart: 40,
  fleetsStart: 100,
  assemblyPoint: 130,
  beachesStart: 260,
  statsStart: 360,
  zoomStart: 320,
  outroStart: 460,
};

export function DDayMap() {
  const frame = useCurrentFrame();
  if (typeof window !== 'undefined') debugCoordinates();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const fadeOut = interpolate(frame, [460, 490], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = Math.min(fadeIn, fadeOut);

  return (
    <div style={{
      width: 1216,
      height: 1920,
      position: 'relative',
      overflow: 'hidden',
      backgroundColor: '#000',
      opacity,
    }}>

      {/* === BASE MAP === */}
      <Img
        src={staticFile('images/dday-map-wide.jpg')}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          position: 'absolute',
          top: 0,
          left: 0,
          transformOrigin: '52% 58%',
          transform: `scale(${interpolate(frame, [TIMING.zoomStart, TIMING.outroStart], [1, 1.6], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })})`,
        }}
      />

      {/* === DARK OVERLAY === */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.1), rgba(0,0,0,0.4))',
      }} />

      {/* === TITLE CARD === */}
      {frame < 60 && (
        <div style={{
          position: 'absolute',
          top: 120,
          left: 0,
          right: 0,
          textAlign: 'center',
          padding: '0 40px',
        }}>
          <div style={{
            fontFamily: 'Bebas Neue',
            fontSize: 72,
            color: '#FFD700',
            letterSpacing: 6,
            textShadow: '0 0 30px rgba(255,215,0,0.6)',
            lineHeight: 1.1,
          }}>
            JUNE 6, 1944
          </div>
          <div style={{
            width: 300,
            height: 3,
            backgroundColor: '#FFD700',
            margin: '20px auto',
            boxShadow: '0 0 12px rgba(255,215,0,0.8)',
          }} />
          <div style={{
            fontFamily: 'Bebas Neue',
            fontSize: 42,
            color: 'white',
            letterSpacing: 4,
            lineHeight: 1.2,
          }}>
            THE LARGEST SEABORNE{'\n'}INVASION IN HISTORY
          </div>
        </div>
      )}

      {/* === NAVAL ROUTES === */}
      <AnimatedRoute
        waypoints={DDAYDATA.navalRoutes.utah_route}
        color="#4A9EFF"
        strokeWidth={7}
        startFrame={TIMING.fleetsStart}
        durationFrames={140}
        mapConfig={WIDE_MAP}
        glowIntensity={12}
        animated
      />
      <AnimatedRoute
        waypoints={DDAYDATA.navalRoutes.omaha_route}
        color="#4A9EFF"
        strokeWidth={7}
        startFrame={TIMING.fleetsStart + 10}
        durationFrames={140}
        mapConfig={WIDE_MAP}
        glowIntensity={12}
        animated
      />
      <AnimatedRoute
        waypoints={DDAYDATA.navalRoutes.gold_route}
        color="#FF4444"
        strokeWidth={7}
        startFrame={TIMING.fleetsStart + 20}
        durationFrames={140}
        mapConfig={WIDE_MAP}
        glowIntensity={12}
        animated
      />
      <AnimatedRoute
        waypoints={DDAYDATA.navalRoutes.juno_route}
        color="#FF4444"
        strokeWidth={7}
        startFrame={TIMING.fleetsStart + 30}
        durationFrames={140}
        mapConfig={WIDE_MAP}
        glowIntensity={12}
        animated
      />
      <AnimatedRoute
        waypoints={DDAYDATA.navalRoutes.sword_route}
        color="#FF4444"
        strokeWidth={7}
        startFrame={TIMING.fleetsStart + 40}
        durationFrames={140}
        mapConfig={WIDE_MAP}
        glowIntensity={12}
        animated
      />

      {/* === PICCADILLY CIRCUS === */}
      <MapMarker
        lngLat={DDAYDATA.assemblyPoints.piccadillyCircus}
        label="PICCADILLY CIRCUS"
        color="#FFD700"
        appearFrame={TIMING.assemblyPoint}
        type="pulse"
        mapConfig={WIDE_MAP}
      />

      {/* === BEACH MARKERS === */}
      <MapMarker lngLat={DDAYDATA.beaches.utah} label="UTAH" color="#4A9EFF"
        appearFrame={TIMING.beachesStart} type="pulse" mapConfig={WIDE_MAP} />
      <MapMarker lngLat={DDAYDATA.beaches.omaha} label="OMAHA" color="#4A9EFF"
        appearFrame={TIMING.beachesStart + 15} type="pulse" mapConfig={WIDE_MAP} />
      <MapMarker lngLat={DDAYDATA.beaches.gold} label="GOLD" color="#FF4444"
        appearFrame={TIMING.beachesStart + 25} type="pulse" mapConfig={WIDE_MAP} />
      <MapMarker lngLat={DDAYDATA.beaches.juno} label="JUNO" color="#FF4444"
        appearFrame={TIMING.beachesStart + 35} type="pulse" mapConfig={WIDE_MAP} />
      <MapMarker lngLat={DDAYDATA.beaches.sword} label="SWORD" color="#FF4444"
        appearFrame={TIMING.beachesStart + 45} type="pulse" mapConfig={WIDE_MAP} />

      {/* === AIRBORNE === */}
      <MapMarker lngLat={DDAYDATA.airborne.zone_82nd_A} label="82nd AIRBORNE" color="#FFD700"
        appearFrame={TIMING.airborneStart} type="pulse" mapConfig={WIDE_MAP} />
      <MapMarker lngLat={DDAYDATA.airborne.zone_101_A} label="101st AIRBORNE" color="#FFD700"
        appearFrame={TIMING.airborneStart + 20} type="pulse" mapConfig={WIDE_MAP} />
      <MapMarker lngLat={DDAYDATA.airborne.pegasusbridge} label="PEGASUS BRIDGE" color="#FF4444"
        appearFrame={TIMING.airborneStart + 40} type="pulse" mapConfig={WIDE_MAP} />

      {/* === STATS === */}
      <StatCallout stat="156,000" label="ALLIED TROOPS"
        appearFrame={TIMING.statsStart}
        position={{ x: 608, y: 1600 }}
        color="#FFD700"
      />
      <StatCallout stat="6,900+" label="VESSELS"
        appearFrame={TIMING.statsStart + 45}
        position={{ x: 608, y: 1780 }}
        color="#FFD700"
      />

      {/* === LEGEND === */}
      {frame >= TIMING.beachesStart && (
        <div style={{
          position: 'absolute',
          top: 60,
          right: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          backgroundColor: 'rgba(0,0,0,0.6)',
          padding: '16px 20px',
          borderLeft: '3px solid #FFD700',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 4, backgroundColor: '#4A9EFF', borderRadius: 2, boxShadow: '0 0 6px #4A9EFF' }} />
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 22, color: 'white', letterSpacing: 2 }}>US FORCES</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 4, backgroundColor: '#FF4444', borderRadius: 2, boxShadow: '0 0 6px #FF4444' }} />
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 22, color: 'white', letterSpacing: 2 }}>BRITISH / CANADIAN</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 28, height: 4, backgroundColor: '#FFD700', borderRadius: 2, boxShadow: '0 0 6px #FFD700' }} />
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 22, color: 'white', letterSpacing: 2 }}>AIRBORNE</div>
          </div>
        </div>
      )}

    </div>
  );
}

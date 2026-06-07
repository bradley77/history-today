import { useCurrentFrame, Img, interpolate, staticFile } from 'remotion';
import { AnimatedRoute } from '../components/AnimatedRoute';
import { MapMarker } from '../components/MapMarker';
import { StatCallout } from '../components/StatCallout';
import { DDAYDATA } from '../data/dday-coordinates';
import { debugCoordinates } from '../utils/mapProjection';

const WIDE_MAP = { center: [-1.0, 50.2], zoom: 8.2, width: 1216, height: 1920, yOffset: -380 };

const TIMING = {
  titleIn: 0,
  titleOut: 90,
  airborneStart: 70,
  fleetsStart: 110,
  assemblyPoint: 160,
  beachesStart: 280,
  statsStart: 360,
  zoomStart: 340,
  outroStart: 470,
};

export function DDayMap() {
  const frame = useCurrentFrame();
  if (typeof window !== 'undefined') debugCoordinates();

  const fadeIn = interpolate(frame, [0, 20], [0, 1], {
    extrapolateRight: 'clamp',
  });

  const fadeOut = interpolate(frame, [470, 510], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const opacity = Math.min(fadeIn, fadeOut);

  // Ken Burns zoom into Normandy beaches
  const mapScale = interpolate(
    frame,
    [TIMING.zoomStart, TIMING.outroStart],
    [1, 1.7],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

  // Title fade out
  const titleOpacity = interpolate(
    frame,
    [60, 90],
    [1, 0],
    { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' }
  );

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
      <div style={{
        position: 'absolute',
        inset: 0,
        transformOrigin: '50% 62%',
        transform: `scale(${mapScale})`,
      }}>
        <Img
          src={staticFile('images/dday-map-wide.jpg')}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            position: 'absolute',
            top: 0,
            left: 0,
          }}
        />
      </div>

      {/* === DARK OVERLAY === */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0.05) 40%, rgba(0,0,0,0.05) 70%, rgba(0,0,0,0.55) 100%)',
        pointerEvents: 'none',
      }} />

      {/* === NAVAL ROUTES === */}
      <AnimatedRoute
        waypoints={DDAYDATA.navalRoutes.utah_route}
        color="#4A9EFF"
        strokeWidth={7}
        startFrame={TIMING.fleetsStart}
        durationFrames={150}
        mapConfig={WIDE_MAP}
        glowIntensity={12}
        animated
      />
      <AnimatedRoute
        waypoints={DDAYDATA.navalRoutes.omaha_route}
        color="#4A9EFF"
        strokeWidth={7}
        startFrame={TIMING.fleetsStart + 12}
        durationFrames={150}
        mapConfig={WIDE_MAP}
        glowIntensity={12}
        animated
      />
      <AnimatedRoute
        waypoints={DDAYDATA.navalRoutes.gold_route}
        color="#FF4444"
        strokeWidth={7}
        startFrame={TIMING.fleetsStart + 24}
        durationFrames={150}
        mapConfig={WIDE_MAP}
        glowIntensity={12}
        animated
      />
      <AnimatedRoute
        waypoints={DDAYDATA.navalRoutes.juno_route}
        color="#FF4444"
        strokeWidth={7}
        startFrame={TIMING.fleetsStart + 36}
        durationFrames={150}
        mapConfig={WIDE_MAP}
        glowIntensity={12}
        animated
      />
      <AnimatedRoute
        waypoints={DDAYDATA.navalRoutes.sword_route}
        color="#FF4444"
        strokeWidth={7}
        startFrame={TIMING.fleetsStart + 48}
        durationFrames={150}
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
        labelOffset={{ x: 18, y: -8 }}
      />

      {/* === BEACH MARKERS === */}
      <MapMarker lngLat={DDAYDATA.beaches.utah} label="UTAH" color="#4A9EFF"
        appearFrame={TIMING.beachesStart} type="pulse" mapConfig={WIDE_MAP}
        labelOffset={{ x: -55, y: -26 }} />
      <MapMarker lngLat={DDAYDATA.beaches.omaha} label="OMAHA" color="#4A9EFF"
        appearFrame={TIMING.beachesStart + 18} type="pulse" mapConfig={WIDE_MAP}
        labelOffset={{ x: -65, y: 18 }} />
      <MapMarker lngLat={DDAYDATA.beaches.gold} label="GOLD" color="#FF4444"
        appearFrame={TIMING.beachesStart + 28} type="pulse" mapConfig={WIDE_MAP}
        labelOffset={{ x: 18, y: -26 }} />
      <MapMarker lngLat={DDAYDATA.beaches.juno} label="JUNO" color="#FF4444"
        appearFrame={TIMING.beachesStart + 38} type="pulse" mapConfig={WIDE_MAP}
        labelOffset={{ x: 18, y: -8 }} />
      <MapMarker lngLat={DDAYDATA.beaches.sword} label="SWORD" color="#FF4444"
        appearFrame={TIMING.beachesStart + 48} type="pulse" mapConfig={WIDE_MAP}
        labelOffset={{ x: 18, y: 18 }} />

      {/* === AIRBORNE === */}
      <MapMarker lngLat={DDAYDATA.airborne.zone_82nd_A} label="82nd AIRBORNE"
        color="#FFD700" appearFrame={TIMING.airborneStart} type="pulse"
        mapConfig={WIDE_MAP} labelOffset={{ x: -105, y: -26 }} />
      <MapMarker lngLat={DDAYDATA.airborne.zone_101_A} label="101st AIRBORNE"
        color="#FFD700" appearFrame={TIMING.airborneStart + 20} type="pulse"
        mapConfig={WIDE_MAP} labelOffset={{ x: -110, y: 18 }} />
      <MapMarker lngLat={DDAYDATA.airborne.pegasusbridge} label="PEGASUS BRIDGE"
        color="#FF8C00" appearFrame={TIMING.airborneStart + 40} type="pulse"
        mapConfig={WIDE_MAP} labelOffset={{ x: 18, y: -26 }} />

      {/* === STATS — appear after routes complete === */}
      <StatCallout stat="156,000" label="ALLIED TROOPS"
        appearFrame={TIMING.statsStart}
        position={{ x: 608, y: 1720 }}
        color="#FFD700"
      />

      {/* === TITLE CARD === */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        paddingTop: 140,
        opacity: titleOpacity,
        pointerEvents: 'none',
      }}>
        <div style={{
          fontFamily: 'Bebas Neue',
          fontSize: 96,
          color: '#FFD700',
          letterSpacing: 8,
          textShadow: '0 0 40px rgba(255,215,0,0.7), 0 2px 4px rgba(0,0,0,0.9)',
          lineHeight: 1,
        }}>
          JUNE 6
        </div>
        <div style={{
          fontFamily: 'Bebas Neue',
          fontSize: 96,
          color: '#FFD700',
          letterSpacing: 8,
          textShadow: '0 0 40px rgba(255,215,0,0.7), 0 2px 4px rgba(0,0,0,0.9)',
          lineHeight: 1,
          marginBottom: 24,
        }}>
          1944
        </div>
        <div style={{
          width: 320,
          height: 3,
          backgroundColor: '#FFD700',
          boxShadow: '0 0 16px rgba(255,215,0,0.9)',
          marginBottom: 28,
        }} />
        <div style={{
          fontFamily: 'Bebas Neue',
          fontSize: 44,
          color: 'white',
          letterSpacing: 5,
          textAlign: 'center',
          lineHeight: 1.3,
          textShadow: '0 2px 8px rgba(0,0,0,0.9)',
          padding: '0 60px',
        }}>
          THE LARGEST SEABORNE INVASION IN HISTORY
        </div>
      </div>

      {/* === LEGEND — bottom left, never clipped === */}
      {frame >= TIMING.fleetsStart && (
        <div style={{
          position: 'absolute',
          bottom: 100,
          left: 40,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          backgroundColor: 'rgba(0,0,0,0.72)',
          padding: '18px 24px',
          borderLeft: '3px solid #FFD700',
          boxShadow: '0 0 20px rgba(0,0,0,0.5)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 28, height: 4, backgroundColor: '#4A9EFF', borderRadius: 2, boxShadow: '0 0 6px #4A9EFF' }} />
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 22, color: 'white', letterSpacing: 2 }}>US FORCES</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 28, height: 4, backgroundColor: '#FF4444', borderRadius: 2, boxShadow: '0 0 6px #FF4444' }} />
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 22, color: 'white', letterSpacing: 2 }}>BRITISH / CANADIAN</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 28, height: 4, backgroundColor: '#FFD700', borderRadius: 2, boxShadow: '0 0 6px #FFD700' }} />
            <div style={{ fontFamily: 'Bebas Neue', fontSize: 22, color: 'white', letterSpacing: 2 }}>AIRBORNE</div>
          </div>
        </div>
      )}

      {/* === OUTRO TITLE === */}
      {frame >= TIMING.outroStart && (
        <div style={{
          position: 'absolute',
          bottom: 160,
          left: 0,
          right: 0,
          textAlign: 'center',
          opacity: interpolate(frame, [TIMING.outroStart, TIMING.outroStart + 30], [0, 1], { extrapolateRight: 'clamp' }),
        }}>
          <div style={{
            fontFamily: 'Bebas Neue',
            fontSize: 52,
            color: '#FFD700',
            letterSpacing: 5,
            textShadow: '0 0 20px rgba(255,215,0,0.6)',
          }}>
            THE BEGINNING OF THE END
          </div>
          <div style={{
            fontFamily: 'Bebas Neue',
            fontSize: 30,
            color: 'white',
            letterSpacing: 3,
            marginTop: 8,
          }}>
            FOR NAZI GERMANY
          </div>
        </div>
      )}

    </div>
  );
}

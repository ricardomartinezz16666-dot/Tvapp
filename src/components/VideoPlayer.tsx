import React, { useEffect, useRef, useState, useCallback } from 'react';
import Hls from 'hls.js';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCw,
  Tv,
  Film,
  Clapperboard,
  AlertCircle,
  Loader2,
  Scaling,
  FastForward,
  Rewind,
} from 'lucide-react';
import { ChannelItem, AspectRatio } from '../types/iptv';

interface VideoPlayerProps {
  channel: ChannelItem | null;
  onNextChannel?: () => void;
  onPrevChannel?: () => void;
  isSmartTv?: boolean;
}

export const VideoPlayer: React.FC<VideoPlayerProps> = ({
  channel,
  onNextChannel,
  onPrevChannel,
  isSmartTv = false,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isBuffering, setIsBuffering] = useState<boolean>(true);
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>('16:9');
  const [bufferSec, setBufferSec] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showControls, setShowControls] = useState<boolean>(true);
  const [qualities, setQualities] = useState<string[]>([]);
  const [currentQuality, setCurrentQuality] = useState<number>(-1); // -1 = Auto

  // VOD Timeline and seeking states
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isSeeking, setIsSeeking] = useState<boolean>(false);

  // Player Format mode: 'mp4' for Movies/Series, 'm3u8' for Live TV
  const [playerFormat, setPlayerFormat] = useState<'m3u8' | 'mp4'>(() => {
    return channel?.type === 'movies' || channel?.type === 'series' ? 'mp4' : 'm3u8';
  });

  // Automatically switch: MP4 for Movies & Series, return to M3U8 for Live TV
  useEffect(() => {
    if (!channel) return;
    if (channel.type === 'movies' || channel.type === 'series') {
      setPlayerFormat('mp4');
    } else {
      setPlayerFormat('m3u8');
    }
  }, [channel?.id, channel?.type]);

  const isVod =
    Boolean(
      channel &&
        (channel.type === 'movies' ||
          channel.type === 'series' ||
          playerFormat === 'mp4')
    );

  const hideControlsTimer = useRef<NodeJS.Timeout | null>(null);

  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (hideControlsTimer.current) clearTimeout(hideControlsTimer.current);
    hideControlsTimer.current = setTimeout(() => {
      if (isPlaying && !isBuffering) {
        setShowControls(false);
      }
    }, 4000);
  }, [isPlaying, isBuffering]);

  // Monitor buffer length in seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const v = videoRef.current;
      if (!v || v.buffered.length === 0) {
        setBufferSec(0);
        return;
      }
      try {
        const ct = v.currentTime;
        let bufLen = 0;
        for (let i = 0; i < v.buffered.length; i++) {
          if (v.buffered.start(i) <= ct && ct <= v.buffered.end(i)) {
            bufLen = Math.round(v.buffered.end(i) - ct);
            break;
          }
        }
        setBufferSec(bufLen);
      } catch (e) {
        // ignore
      }
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handle Seekbar for VOD
  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const targetTime = parseFloat(e.target.value);
    setCurrentTime(targetTime);
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
    }
    resetControlsTimer();
  };

  const skipTime = (seconds: number) => {
    if (!videoRef.current) return;
    const cur = videoRef.current.currentTime;
    const dur = videoRef.current.duration || duration || 0;
    const next = Math.max(0, Math.min(dur || 999999, cur + seconds));
    videoRef.current.currentTime = next;
    setCurrentTime(next);
    resetControlsTimer();
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs <= 0) return '0:00';
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = Math.floor(secs % 60);
    if (h > 0) {
      return `${h}:${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    }
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  // Initialize playback when channel changes
  const initStream = useCallback(() => {
    if (!channel || !videoRef.current) return;

    setErrorMessage('');
    setIsBuffering(true);
    setCurrentTime(0);
    setDuration(0);

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const video = videoRef.current;
    const streamUrl = channel.streamUrl;

    // If MP4 mode or VOD (movies / series), use MP4 player
    if (playerFormat === 'mp4' || channel.type === 'movies' || channel.type === 'series') {
      const mp4Url = `/api/media/${channel.id}.mp4`;
      video.src = mp4Url;
      video
        .play()
        .then(() => {
          setIsBuffering(false);
          setIsPlaying(true);
        })
        .catch(() => {
          setIsPlaying(false);
        });
      return;
    }

    // M3U8 (HLS) player for Live TV
    const m3u8Url = `/api/stream/${channel.id}.m3u8`;
    if (Hls.isSupported()) {
      const hls = new Hls({
        enableWorker: true,
        lowLatencyMode: false,
        maxBufferLength: 60,
        maxMaxBufferLength: 120,
        maxBufferSize: 60 * 1000 * 1000,
        backBufferLength: 30,
        maxBufferHole: 0.5,
        highBufferWatchdogPeriod: 2,
        nudgeOffset: 0.2,
        nudgeMaxRetry: 5,
        liveSyncDurationCount: 3,
        liveMaxLatencyDurationCount: 10,
        fragLoadingTimeOut: 20000,
        fragLoadingMaxRetry: 6,
        fragLoadingRetryDelay: 1000,
        manifestLoadingTimeOut: 15000,
        manifestLoadingMaxRetry: 5,
      });

      hlsRef.current = hls;
      hls.loadSource(m3u8Url);
      hls.attachMedia(video);

      hls.on(Hls.Events.MANIFEST_PARSED, (_, data) => {
        setIsBuffering(false);
        const qList = data.levels.map((lvl) => `${lvl.height || 'HD'}p`);
        setQualities(qList);
        video.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
      });

      hls.on(Hls.Events.ERROR, (_, data) => {
        if (data.fatal) {
          switch (data.type) {
            case Hls.ErrorTypes.NETWORK_ERROR:
              console.warn('[Facu TV] Network error encountered, recovering...', data.details);
              hls.startLoad();
              break;
            case Hls.ErrorTypes.MEDIA_ERROR:
              console.warn('[Facu TV] Media error, attempting media recovery...', data.details);
              hls.recoverMediaError();
              break;
            default:
              console.error('[Facu TV] Fatal error:', data.details);
              setErrorMessage('La señal está temporalmente inaccesible. Puedes reintentar.');
              hls.destroy();
              break;
          }
        }
      });
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
      // Safari / iOS Native HLS
      video.src = m3u8Url;
      video
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      setErrorMessage('Tu navegador no soporta reproducción HLS');
    }
  }, [channel, playerFormat]);

  useEffect(() => {
    initStream();
    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [initStream]);

  // Handle Play/Pause
  const togglePlay = () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.pause();
      setIsPlaying(false);
    } else {
      videoRef.current.play();
      setIsPlaying(true);
    }
    resetControlsTimer();
  };

  // Handle Volume
  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      videoRef.current.muted = val === 0;
      setIsMuted(val === 0);
    }
    resetControlsTimer();
  };

  const toggleMute = () => {
    if (!videoRef.current) return;
    const nextMuted = !isMuted;
    videoRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
    resetControlsTimer();
  };

  // Handle Aspect Ratio
  const cycleAspectRatio = () => {
    if (aspectRatio === '16:9') setAspectRatio('fill');
    else if (aspectRatio === 'fill') setAspectRatio('4:3');
    else setAspectRatio('16:9');
    resetControlsTimer();
  };

  // Handle Fullscreen
  const toggleFullscreen = () => {
    const elem = containerRef.current;
    if (!elem) return;

    if (!document.fullscreenElement) {
      elem.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
    resetControlsTimer();
  };

  // Video aspect ratio classes
  const getAspectClass = () => {
    switch (aspectRatio) {
      case 'fill':
        return 'w-full h-full object-cover';
      case '4:3':
        return 'w-full h-full object-contain max-w-[75vw] mx-auto';
      case '16:9':
      default:
        return 'w-full h-full object-contain';
    }
  };

  if (!channel) {
    return (
      <div className="w-full aspect-video bg-neutral-950 flex flex-col items-center justify-center text-neutral-500 border-b border-neutral-800">
        <Tv className="w-12 h-12 mb-3 text-neutral-600" />
        <p className="text-sm font-medium">Selecciona un canal para comenzar a transmitir</p>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      onMouseMove={resetControlsTimer}
      onTouchStart={resetControlsTimer}
      className={`relative w-full aspect-video bg-black overflow-hidden select-none group ${
        isFullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'relative'
      }`}
    >
      {/* Video Element */}
      <video
        ref={videoRef}
        playsInline
        className={`transition-all duration-200 ${getAspectClass()}`}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={() => {
          if (videoRef.current && !isSeeking) {
            setCurrentTime(videoRef.current.currentTime);
          }
        }}
        onLoadedMetadata={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration || 0);
            setIsBuffering(false);
          }
        }}
        onDurationChange={() => {
          if (videoRef.current) {
            setDuration(videoRef.current.duration || 0);
          }
        }}
        onError={() => {
          setIsBuffering(false);
          setErrorMessage(
            isVod
              ? 'Error al reproducir el título seleccionado. Puedes reintentar.'
              : 'Error al reproducir el canal seleccionado'
          );
        }}
      />

      {/* Buffering indicator */}
      {isBuffering && !errorMessage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 pointer-events-none">
          <Loader2 className="w-12 h-12 text-amber-400 animate-spin mb-2" />
          <span className="text-xs font-semibold text-white/90 tracking-wide uppercase">
            {isVod ? 'Cargando video...' : 'Cargando señal en vivo...'}
          </span>
        </div>
      )}

      {/* Error Overlay with Retry */}
      {errorMessage && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-950/90 text-center px-4">
          <AlertCircle className="w-10 h-10 text-amber-500 mb-3" />
          <p className="text-sm font-semibold text-white mb-1">{channel.name}</p>
          <p className="text-xs text-neutral-400 max-w-sm mb-4">{errorMessage}</p>
          <button
            onClick={initStream}
            className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-black bg-amber-400 rounded-lg hover:bg-amber-300 transition-colors"
          >
            <RotateCw className="w-4 h-4" />
            Reintentar reproducción
          </button>
        </div>
      )}

      {/* Channel / VOD banner watermark */}
      <div className="absolute top-3 left-3 flex items-center gap-2 pointer-events-none opacity-90 z-20">
        <div className="flex items-center gap-1.5 px-2.5 py-1 bg-black/70 rounded-md backdrop-blur-sm border border-white/10">
          {!isVod ? (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold text-white tracking-wider uppercase">EN VIVO · M3U8</span>
            </>
          ) : channel.type === 'movies' ? (
            <>
              <Film className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold text-amber-400 tracking-wider uppercase">
                PELÍCULA · {playerFormat.toUpperCase()}
              </span>
            </>
          ) : (
            <>
              <Clapperboard className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px] font-bold text-amber-400 tracking-wider uppercase">
                SERIE {channel.season ? `· T${channel.season}` : ''} {channel.episode ? `E${channel.episode}` : ''} · {playerFormat.toUpperCase()}
              </span>
            </>
          )}
        </div>
        <div className="px-2.5 py-1 bg-black/70 rounded-md backdrop-blur-sm border border-white/10 max-w-[200px] truncate">
          <span className="text-xs font-semibold text-neutral-200">{channel.name}</span>
        </div>
      </div>

      {/* Buffer health badge */}
      {!isVod && bufferSec > 0 && (
        <div className="absolute top-3 right-3 flex items-center gap-2 pointer-events-none z-20">
          <div className="px-2 py-0.5 bg-black/60 rounded text-[10px] text-amber-300/90 font-mono border border-amber-500/20">
            Buffer: {bufferSec}s
          </div>
        </div>
      )}

      {/* Player Controls Overlay */}
      <div
        className={`absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/30 flex flex-col justify-between p-4 transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
      >
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {channel.logo ? (
              <img
                src={channel.logo}
                alt={channel.name}
                referrerPolicy="no-referrer"
                className="w-10 h-10 object-contain rounded bg-neutral-900/80 p-1 border border-neutral-700"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-10 h-10 rounded bg-neutral-800 flex items-center justify-center text-neutral-400">
                {isVod ? (
                  channel.type === 'movies' ? <Film className="w-5 h-5" /> : <Clapperboard className="w-5 h-5" />
                ) : (
                  <Tv className="w-5 h-5" />
                )}
              </div>
            )}
            <div>
              <h2 className="text-sm md:text-base font-bold text-white truncate max-w-xs md:max-w-md">
                {channel.name}
              </h2>
              <p className="text-xs text-neutral-400">{channel.group}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Player Format Toggle Button (MP4 / M3U8) */}
            <button
              onClick={() => setPlayerFormat((prev) => (prev === 'mp4' ? 'm3u8' : 'mp4'))}
              title={`Formato de video actual: ${playerFormat.toUpperCase()}. Haz clic para alternar.`}
              className={`px-2.5 py-1 rounded text-[11px] font-mono font-bold transition-all border flex items-center gap-1 ${
                playerFormat === 'mp4'
                  ? 'bg-amber-400 text-black border-amber-300 shadow-md'
                  : 'bg-neutral-800 text-neutral-300 border-neutral-700 hover:text-white'
              }`}
            >
              <span>{playerFormat.toUpperCase()}</span>
            </button>

            <button
              onClick={initStream}
              title="Refrescar transmisión"
              className="p-2 text-neutral-300 hover:text-white bg-black/40 rounded-lg hover:bg-white/10 transition-colors"
            >
              <RotateCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Center play/pause/skip click target */}
        <div className="flex items-center justify-center gap-6">
          {isVod && (
            <button
              onClick={() => skipTime(-10)}
              title="Retroceder 10 segundos"
              className="p-2.5 md:p-3 rounded-full bg-black/60 text-white hover:text-amber-400 hover:bg-black/80 transition-colors"
            >
              <Rewind className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}

          <button
            onClick={togglePlay}
            className="p-3 md:p-4 rounded-full bg-amber-400 text-black hover:bg-amber-300 transition-transform active:scale-95 shadow-xl"
          >
            {isPlaying ? (
              <Pause className="w-6 h-6 md:w-8 md:h-8 fill-black" />
            ) : (
              <Play className="w-6 h-6 md:w-8 md:h-8 fill-black ml-1" />
            )}
          </button>

          {isVod && (
            <button
              onClick={() => skipTime(10)}
              title="Adelantar 10 segundos"
              className="p-2.5 md:p-3 rounded-full bg-black/60 text-white hover:text-amber-400 hover:bg-black/80 transition-colors"
            >
              <FastForward className="w-5 h-5 md:w-6 md:h-6" />
            </button>
          )}
        </div>

        {/* Bottom bar container */}
        <div className="flex flex-col gap-2">
          {/* VOD Progress / Scrubber Bar */}
          {isVod && (
            <div className="flex items-center gap-3 bg-black/40 p-1.5 rounded-lg backdrop-blur-sm">
              <span className="text-[11px] font-mono text-neutral-300 min-w-[45px] text-right">
                {formatTime(currentTime)}
              </span>
              <input
                type="range"
                min={0}
                max={duration > 0 ? duration : 100}
                step={1}
                value={currentTime}
                onMouseDown={() => setIsSeeking(true)}
                onTouchStart={() => setIsSeeking(true)}
                onMouseUp={() => setIsSeeking(false)}
                onTouchEnd={() => setIsSeeking(false)}
                onChange={handleSeek}
                className="flex-1 accent-amber-400 cursor-pointer h-1.5 bg-neutral-700/80 rounded-lg hover:h-2 transition-all"
              />
              <span className="text-[11px] font-mono text-neutral-400 min-w-[45px]">
                {formatTime(duration)}
              </span>
            </div>
          )}

          {/* Bottom controls row */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Volume & Channel Switch */}
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMute}
                className="p-2 text-neutral-300 hover:text-white transition-colors"
              >
                {isMuted || volume === 0 ? (
                  <VolumeX className="w-5 h-5 text-red-400" />
                ) : (
                  <Volume2 className="w-5 h-5" />
                )}
              </button>
              <input
                type="range"
                min="0"
                max="1"
                step="0.05"
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                className="w-16 md:w-24 accent-amber-400 cursor-pointer h-1.5 bg-neutral-700 rounded-lg"
              />
            </div>

            {/* Right: Aspect ratio & Fullscreen */}
            <div className="flex items-center gap-2">
              <button
                onClick={cycleAspectRatio}
                title="Relación de aspecto (16:9 / Ajustar / 4:3)"
                className="px-2.5 py-1 text-xs font-semibold text-neutral-300 hover:text-white bg-white/10 rounded hover:bg-white/20 transition-colors flex items-center gap-1.5"
              >
                <Scaling className="w-3.5 h-3.5" />
                <span>{aspectRatio.toUpperCase()}</span>
              </button>

              <button
                onClick={toggleFullscreen}
                title="Pantalla Completa"
                className="p-2 text-neutral-300 hover:text-white transition-colors"
              >
                {isFullscreen ? <Minimize className="w-5 h-5" /> : <Maximize className="w-5 h-5" />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

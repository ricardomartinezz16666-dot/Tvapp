import React, { useEffect, useState, useRef, useCallback } from 'react';
import { ChannelItem, CategoryInfo, AppSection } from '../types/iptv';
import { VideoPlayer } from './VideoPlayer';
import {
  Tv,
  Film,
  Clapperboard,
  Search,
  Clock,
  ChevronRight,
  ChevronLeft,
  Volume2,
  Maximize,
  Sliders,
  Smartphone,
  Info,
} from 'lucide-react';

interface SmartTvViewProps {
  section: AppSection;
  onSectionChange: (section: AppSection) => void;
  channels: ChannelItem[];
  selectedChannel: ChannelItem | null;
  onSelectChannel: (channel: ChannelItem) => void;
  categories: CategoryInfo[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  onSwitchToMobile: () => void;
}

type FocusZone = 'nav' | 'categories' | 'channels' | 'player';

export const SmartTvView: React.FC<SmartTvViewProps> = ({
  section,
  onSectionChange,
  channels,
  selectedChannel,
  onSelectChannel,
  categories,
  selectedCategory,
  onSelectCategory,
  onSwitchToMobile,
}) => {
  const [focusZone, setFocusZone] = useState<FocusZone>('channels');
  const [focusedChannelIndex, setFocusedChannelIndex] = useState<number>(0);
  const [focusedCategoryIndex, setFocusedCategoryIndex] = useState<number>(0);
  const [focusedNavIndex, setFocusedNavIndex] = useState<number>(0); // 0: Live, 1: Movies, 2: Series, 3: Mobile

  // Number dialer for TV remote (e.g. typing "1", "2" tunes channel 12)
  const [dialedNumber, setDialedNumber] = useState<string>('');
  const dialTimer = useRef<NodeJS.Timeout | null>(null);

  const channelListRef = useRef<HTMLDivElement>(null);

  // Sync focused index if selectedChannel changes
  useEffect(() => {
    if (selectedChannel) {
      const idx = channels.findIndex((c) => c.id === selectedChannel.id);
      if (idx !== -1) setFocusedChannelIndex(idx);
    }
  }, [selectedChannel, channels]);

  // Scroll focused channel into view
  useEffect(() => {
    if (focusZone === 'channels' && channelListRef.current) {
      const el = channelListRef.current.children[focusedChannelIndex] as HTMLElement;
      if (el) {
        el.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [focusedChannelIndex, focusZone]);

  // Handle number dialing
  const handleDigitInput = useCallback(
    (digit: string) => {
      const nextNum = dialedNumber + digit;
      setDialedNumber(nextNum);

      if (dialTimer.current) clearTimeout(dialTimer.current);
      dialTimer.current = setTimeout(() => {
        const targetNum = parseInt(nextNum, 10);
        if (targetNum > 0 && targetNum <= channels.length) {
          const targetChannel = channels[targetNum - 1];
          onSelectChannel(targetChannel);
          setFocusedChannelIndex(targetNum - 1);
        }
        setDialedNumber('');
      }, 1500);
    },
    [dialedNumber, channels, onSelectChannel]
  );

  // D-Pad Remote Navigation Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Direct number entry (0-9)
      if (e.key >= '0' && e.key <= '9') {
        handleDigitInput(e.key);
        return;
      }

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (focusZone === 'channels') {
            setFocusedChannelIndex((prev) => Math.max(0, prev - 1));
          } else if (focusZone === 'categories') {
            setFocusedCategoryIndex((prev) => Math.max(0, prev - 1));
          } else if (focusZone === 'nav') {
            setFocusedNavIndex((prev) => Math.max(0, prev - 1));
          }
          break;

        case 'ArrowDown':
          e.preventDefault();
          if (focusZone === 'channels') {
            setFocusedChannelIndex((prev) => Math.min(channels.length - 1, prev + 1));
          } else if (focusZone === 'categories') {
            setFocusedCategoryIndex((prev) => Math.min(categories.length, prev + 1));
          } else if (focusZone === 'nav') {
            setFocusedNavIndex((prev) => Math.min(3, prev + 1));
          }
          break;

        case 'ArrowLeft':
          e.preventDefault();
          if (focusZone === 'player') {
            setFocusZone('channels');
          } else if (focusZone === 'channels') {
            setFocusZone('categories');
          } else if (focusZone === 'categories') {
            setFocusZone('nav');
          }
          break;

        case 'ArrowRight':
          e.preventDefault();
          if (focusZone === 'nav') {
            setFocusZone('categories');
          } else if (focusZone === 'categories') {
            setFocusZone('channels');
          } else if (focusZone === 'channels') {
            setFocusZone('player');
          }
          break;

        case 'Enter':
          e.preventDefault();
          if (focusZone === 'channels') {
            const ch = channels[focusedChannelIndex];
            if (ch) onSelectChannel(ch);
          } else if (focusZone === 'categories') {
            if (focusedCategoryIndex === 0) {
              onSelectCategory('ALL');
            } else {
              const cat = categories[focusedCategoryIndex - 1];
              if (cat) onSelectCategory(cat.name);
            }
            setFocusZone('channels');
          } else if (focusZone === 'nav') {
            if (focusedNavIndex === 0) onSectionChange('live');
            else if (focusedNavIndex === 1) onSectionChange('movies');
            else if (focusedNavIndex === 2) onSectionChange('series');
            else if (focusedNavIndex === 3) onSwitchToMobile();
          }
          break;

        case 'Escape':
        case 'Backspace':
          e.preventDefault();
          if (focusZone === 'player') setFocusZone('channels');
          else if (focusZone === 'channels') setFocusZone('categories');
          else if (focusZone === 'categories') setFocusZone('nav');
          break;

        case 'PageUp':
          e.preventDefault();
          setFocusedChannelIndex((prev) => Math.max(0, prev - 10));
          break;

        case 'PageDown':
          e.preventDefault();
          setFocusedChannelIndex((prev) => Math.min(channels.length - 1, prev + 10));
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    focusZone,
    focusedChannelIndex,
    focusedCategoryIndex,
    focusedNavIndex,
    channels,
    categories,
    onSelectChannel,
    onSelectCategory,
    onSectionChange,
    onSwitchToMobile,
    handleDigitInput,
  ]);

  const currentProgram = selectedChannel?.epg?.current;
  const upcomingProgram = selectedChannel?.epg?.upcoming?.[0];

  return (
    <div className="h-screen w-screen bg-black text-white flex flex-col overflow-hidden select-none">
      {/* Top TV status header */}
      <div className="h-12 bg-neutral-900 border-b border-neutral-800 px-6 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <h1 className="text-base font-black tracking-tight text-white uppercase">Facu TV</h1>
          </div>
          <span className="text-xs text-neutral-500">·</span>
          <span className="text-xs font-semibold text-amber-400 tracking-wider">MODO SMART TV (1GB RAM OPTIMIZADO)</span>
        </div>

        {/* Dialed Number Overlay */}
        {dialedNumber && (
          <div className="bg-amber-400 text-black px-4 py-1 rounded font-mono font-black text-sm animate-pulse">
            CANAL: {dialedNumber}
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-neutral-400">
          <span>Usa <strong className="text-neutral-200">Flechas</strong> y <strong className="text-neutral-200">OK</strong> del control</span>
          <button
            onClick={onSwitchToMobile}
            className={`px-3 py-1 rounded text-xs font-bold transition-all ${
              focusZone === 'nav' && focusedNavIndex === 3
                ? 'ring-2 ring-amber-400 bg-amber-400 text-black'
                : 'bg-neutral-800 text-neutral-300 hover:text-white'
            }`}
          >
            Modo Móvil
          </button>
        </div>
      </div>

      {/* Main TV Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Navigation & Categories */}
        <div className="w-56 bg-neutral-950 border-r border-neutral-800 flex flex-col shrink-0">
          {/* Section Picker */}
          <div className="p-3 border-b border-neutral-800 flex flex-col gap-1">
            <button
              onClick={() => onSectionChange('live')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                section === 'live'
                  ? 'bg-amber-400 text-black font-extrabold'
                  : 'text-neutral-400 hover:bg-neutral-900'
              } ${focusZone === 'nav' && focusedNavIndex === 0 ? 'ring-4 ring-white' : ''}`}
            >
              <Tv className="w-4 h-4" />
              <span>En Vivo</span>
            </button>
            <button
              onClick={() => onSectionChange('movies')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                section === 'movies'
                  ? 'bg-amber-400 text-black font-extrabold'
                  : 'text-neutral-400 hover:bg-neutral-900'
              } ${focusZone === 'nav' && focusedNavIndex === 1 ? 'ring-4 ring-white' : ''}`}
            >
              <Film className="w-4 h-4" />
              <span>Películas</span>
            </button>
            <button
              onClick={() => onSectionChange('series')}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-bold transition-all text-left ${
                section === 'series'
                  ? 'bg-amber-400 text-black font-extrabold'
                  : 'text-neutral-400 hover:bg-neutral-900'
              } ${focusZone === 'nav' && focusedNavIndex === 2 ? 'ring-4 ring-white' : ''}`}
            >
              <Clapperboard className="w-4 h-4" />
              <span>Series</span>
            </button>
          </div>

          {/* Categories List */}
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <div className="text-[10px] font-bold text-neutral-500 uppercase px-2 py-1">
              Categorías ({categories.length})
            </div>
            <button
              onClick={() => onSelectCategory('ALL')}
              className={`w-full text-left px-2.5 py-1.5 rounded text-xs truncate transition-all ${
                selectedCategory === 'ALL'
                  ? 'bg-neutral-800 text-amber-400 font-bold'
                  : 'text-neutral-400 hover:bg-neutral-900'
              } ${
                focusZone === 'categories' && focusedCategoryIndex === 0
                  ? 'ring-2 ring-amber-400 bg-amber-400/20 text-white font-bold'
                  : ''
              }`}
            >
              Todas las categorías
            </button>
            {categories.map((cat, idx) => (
              <button
                key={cat.name}
                onClick={() => onSelectCategory(cat.name)}
                className={`w-full text-left px-2.5 py-1.5 rounded text-xs truncate transition-all ${
                  selectedCategory === cat.name
                    ? 'bg-neutral-800 text-amber-400 font-bold'
                    : 'text-neutral-400 hover:bg-neutral-900'
                } ${
                  focusZone === 'categories' && focusedCategoryIndex === idx + 1
                    ? 'ring-2 ring-amber-400 bg-amber-400/20 text-white font-bold'
                    : ''
                }`}
              >
                {cat.name} ({cat.count})
              </button>
            ))}
          </div>
        </div>

        {/* Center: Channel List (Keyboard/Remote Navigable) */}
        <div className="w-80 bg-neutral-900/60 border-r border-neutral-800 flex flex-col shrink-0">
          <div className="p-3 border-b border-neutral-800 flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-300">
              Canales ({channels.length})
            </span>
            <span className="text-[10px] text-neutral-500">Usa Arriba/Abajo</span>
          </div>

          <div ref={channelListRef} className="flex-1 overflow-y-auto divide-y divide-neutral-800/40 p-1">
            {channels.map((ch, idx) => {
              const isSelected = selectedChannel?.id === ch.id;
              const isFocused = focusZone === 'channels' && focusedChannelIndex === idx;

              return (
                <div
                  key={ch.id}
                  onClick={() => {
                    onSelectChannel(ch);
                    setFocusedChannelIndex(idx);
                    setFocusZone('channels');
                  }}
                  className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                    isFocused
                      ? 'ring-4 ring-amber-400 bg-amber-500/20 text-white font-bold scale-[1.02] shadow-xl'
                      : isSelected
                      ? 'bg-neutral-800 border-l-4 border-l-amber-400'
                      : 'hover:bg-neutral-800/40 text-neutral-300'
                  }`}
                >
                  <span className="text-xs font-mono text-neutral-500 w-6 text-right shrink-0">
                    {idx + 1}
                  </span>

                  <div className="w-8 h-8 rounded bg-neutral-950 p-1 shrink-0 flex items-center justify-center border border-neutral-700">
                    {ch.logo ? (
                      <img
                        src={ch.logo}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                        onError={(e) => {
                          (e.target as HTMLElement).style.display = 'none';
                        }}
                      />
                    ) : (
                      <Tv className="w-4 h-4 text-neutral-500" />
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <h3 className="text-xs font-semibold truncate leading-tight">
                      {ch.name}
                    </h3>
                    <p className="text-[10px] text-neutral-400 truncate mt-0.5">
                      {ch.group}
                    </p>
                  </div>

                  {isSelected && (
                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Side: Player & Pluto TV EPG Info Box */}
        <div className="flex-1 flex flex-col bg-black overflow-hidden">
          {/* Top Video Player */}
          <div className="flex-1 bg-black flex items-center justify-center max-h-[60vh]">
            <VideoPlayer channel={selectedChannel} isSmartTv={true} />
          </div>

          {/* Bottom EPG Guide Card (Pluto TV 10-foot UI) */}
          <div className="h-44 bg-neutral-900 border-t border-neutral-800 p-5 flex flex-col justify-between shrink-0">
            {selectedChannel ? (
              <div className="grid grid-cols-12 gap-6 items-center">
                {/* Channel identity */}
                <div className="col-span-5 flex items-start gap-4">
                  <div className="w-14 h-14 bg-neutral-950 rounded-lg p-1.5 border border-neutral-700 shrink-0 flex items-center justify-center">
                    {selectedChannel.logo ? (
                      <img
                        src={selectedChannel.logo}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <Tv className="w-8 h-8 text-neutral-500" />
                    )}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-0.5 bg-amber-400 text-black font-extrabold text-[10px] rounded uppercase">
                        {selectedChannel.type === 'movies'
                          ? 'PELÍCULA'
                          : selectedChannel.type === 'series'
                          ? 'SERIE'
                          : 'EN VIVO'}
                      </span>
                      <h2 className="text-base font-bold text-white truncate max-w-xs">
                        {selectedChannel.name}
                      </h2>
                    </div>
                    <p className="text-xs text-neutral-400 mt-1">
                      {selectedChannel.group} · Calidad HD 1080p
                    </p>
                  </div>
                </div>

                {/* Program / VOD details */}
                <div className="col-span-7 flex flex-col justify-center">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      {selectedChannel.type === 'movies' ? (
                        <Film className="w-4 h-4 text-amber-400" />
                      ) : selectedChannel.type === 'series' ? (
                        <Clapperboard className="w-4 h-4 text-amber-400" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400" />
                      )}
                      <h3 className="text-sm font-bold text-neutral-100 truncate">
                        {selectedChannel.type === 'movies'
                          ? selectedChannel.name
                          : selectedChannel.type === 'series'
                          ? `${selectedChannel.name}${selectedChannel.season ? ` - T${selectedChannel.season}` : ''}${selectedChannel.episode ? ` E${selectedChannel.episode}` : ''}`
                          : currentProgram?.title || 'Programación en Directo'}
                      </h3>
                    </div>
                    {selectedChannel.type === 'live' && (
                      <span className="text-xs font-mono text-amber-400">
                        {currentProgram?.progress || 50}% Transcurrido
                      </span>
                    )}
                  </div>

                  {/* Progress bar for live channels */}
                  {selectedChannel.type === 'live' && (
                    <div className="w-full bg-neutral-800 h-1.5 rounded-full overflow-hidden mb-2">
                      <div
                        className="bg-amber-400 h-full rounded-full"
                        style={{ width: `${currentProgram?.progress || 50}%` }}
                      />
                    </div>
                  )}

                  <p className="text-xs text-neutral-300 line-clamp-2">
                    {selectedChannel.type === 'movies'
                      ? `Disfruta de ${selectedChannel.name} en streaming HD bajo demanda en Facu TV. Audio y video optimizados sin interrupciones.`
                      : selectedChannel.type === 'series'
                      ? `Capítulo de ${selectedChannel.name} disponible en Facu TV. Disfruta de la mejor calidad de streaming.`
                      : currentProgram?.desc ||
                        'Disfruta de la mejor televisión en vivo sin cortes por Facu TV.'}
                  </p>

                  {selectedChannel.type === 'live' && upcomingProgram && (
                    <p className="text-[11px] text-neutral-500 mt-1 truncate">
                      Siguiente: <strong className="text-neutral-400">{upcomingProgram.title}</strong>
                    </p>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full text-neutral-500 text-xs">
                Selecciona un canal con el control remoto
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

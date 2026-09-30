import React, { useState, useEffect } from 'react';
import { AppSection, ViewMode } from '../types/iptv';
import { Tv, Monitor, Smartphone, Radio, Clock } from 'lucide-react';

interface TopNavProps {
  section: AppSection;
  onSectionChange: (section: AppSection) => void;
  viewMode: ViewMode;
  onToggleViewMode: () => void;
  onToggleRemote: () => void;
  isRemoteOpen: boolean;
  totalChannels?: number;
}

export const TopNav: React.FC<TopNavProps> = ({
  section,
  onSectionChange,
  viewMode,
  onToggleViewMode,
  onToggleRemote,
  isRemoteOpen,
  totalChannels = 0,
}) => {
  const [clock, setClock] = useState<string>('');

  useEffect(() => {
    const update = () => {
      const now = new Date();
      setClock(now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="flex items-center justify-between px-4 md:px-8 py-3 bg-[#0d0e12] border-b border-white/5 shrink-0 select-none z-30 font-sans">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onSectionChange('live');
          }}
          className="text-base md:text-lg font-bold tracking-tight text-white flex items-center gap-2"
        >
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
          <span>Facu TV</span>
        </a>
      </div>

      {/* Zone 2: Navigation Links (Google TV pill tabs) */}
      <nav className="flex items-center gap-1.5 md:gap-2 bg-[#171920] p-1 rounded-full border border-white/5">
        <button
          onClick={() => onSectionChange('live')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
            section === 'live'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          En Vivo
        </button>
        <button
          onClick={() => onSectionChange('movies')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
            section === 'movies'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Películas
        </button>
        <button
          onClick={() => onSectionChange('series')}
          className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all whitespace-nowrap ${
            section === 'series'
              ? 'bg-white text-black font-bold shadow-sm'
              : 'text-neutral-400 hover:text-white'
          }`}
        >
          Series
        </button>
      </nav>

      {/* Zone 3: Actions */}
      <div className="flex items-center gap-2.5">
        {/* Clock */}
        <div className="hidden sm:flex items-center gap-1.5 font-mono text-xs text-neutral-400">
          <Clock className="w-3.5 h-3.5 text-neutral-500" />
          <span>{clock}</span>
        </div>

        {/* Remote Control Trigger */}
        <button
          onClick={onToggleRemote}
          title="Control Remoto Virtual"
          className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-all flex items-center gap-1.5 ${
            isRemoteOpen
              ? 'bg-white text-black border-white'
              : 'bg-[#171920] text-neutral-300 border-white/5 hover:text-white hover:bg-neutral-800'
          }`}
        >
          <Radio className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Control</span>
        </button>

        {/* Smart TV / Mobile Mode Switch */}
        <button
          onClick={onToggleViewMode}
          title="Cambiar Modo"
          className="px-3.5 py-1.5 text-xs font-semibold text-black bg-white hover:bg-neutral-200 rounded-full transition-all flex items-center gap-1.5 whitespace-nowrap shadow-sm"
        >
          {viewMode === 'mobile' ? (
            <>
              <Monitor className="w-3.5 h-3.5" />
              <span>Modo Smart TV</span>
            </>
          ) : (
            <>
              <Smartphone className="w-3.5 h-3.5" />
              <span>Modo Móvil</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};

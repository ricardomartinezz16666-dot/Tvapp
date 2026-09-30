import React from 'react';
import { ChannelItem, CategoryInfo } from '../types/iptv';
import { Tv, Clock, Search, Star } from 'lucide-react';

interface PlutoTvGuideProps {
  channels: ChannelItem[];
  selectedChannel: ChannelItem | null;
  onSelectChannel: (channel: ChannelItem) => void;
  categories: CategoryInfo[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  isLoading?: boolean;
  favorites?: string[];
  onToggleFavorite?: (id: string) => void;
}

export const PlutoTvGuide: React.FC<PlutoTvGuideProps> = ({
  channels,
  selectedChannel,
  onSelectChannel,
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  isLoading = false,
  favorites = [],
  onToggleFavorite,
}) => {
  const now = new Date();
  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });

  const slot1 = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    now.getHours(),
    Math.floor(now.getMinutes() / 30) * 30
  );
  const slot2 = new Date(slot1.getTime() + 30 * 60 * 1000);

  return (
    <div className="flex flex-col bg-[#0e1015] text-neutral-100 min-h-[480px] select-none font-sans">
      {/* Google TV Top Category Bar */}
      <div className="sticky top-0 z-30 bg-[#0e1015]/95 border-b border-white/5 p-3 flex flex-col gap-2.5 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder="Buscar canal en vivo..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-[#181b22] border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder-neutral-500 focus:outline-none focus:border-white/40 focus:ring-1 focus:ring-white/40 transition-all"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Categories Bar in Google TV pill style */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-0.5">
          <button
            onClick={() => onSelectCategory('ALL')}
            className={`px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap rounded-full transition-all shrink-0 ${
              selectedCategory === 'ALL'
                ? 'bg-white text-black font-bold shadow-sm'
                : 'bg-[#181b22] text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            Todos ({channels.length})
          </button>

          {favorites.length > 0 && (
            <button
              onClick={() => onSelectCategory('FAVORITOS')}
              className={`px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap rounded-full transition-all shrink-0 flex items-center gap-1.5 ${
                selectedCategory === 'FAVORITOS'
                  ? 'bg-amber-400 text-black font-bold shadow-sm'
                  : 'bg-[#181b22] text-amber-400 hover:bg-neutral-800'
              }`}
            >
              <Star className="w-3.5 h-3.5 fill-current" />
              <span>Favoritos ({favorites.length})</span>
            </button>
          )}

          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => onSelectCategory(cat.name)}
              className={`px-3.5 py-1.5 text-xs font-semibold whitespace-nowrap rounded-full transition-all shrink-0 ${
                selectedCategory === cat.name
                  ? 'bg-white text-black font-bold shadow-sm'
                  : 'bg-[#181b22] text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Google TV Live Channels List */}
      <div className="divide-y divide-white/5 p-2 md:p-3 space-y-1">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center p-16 text-neutral-500">
            <div className="w-8 h-8 border-2 border-white/40 border-t-transparent rounded-full animate-spin mb-3" />
            <p className="text-xs font-medium">Cargando guía de canales...</p>
          </div>
        ) : channels.length === 0 ? (
          <div className="p-16 text-center text-neutral-500 text-xs">
            No se encontraron canales.
          </div>
        ) : (
          channels.map((ch, idx) => {
            const isSelected = selectedChannel?.id === ch.id;
            const isFav = favorites.includes(ch.id);
            const currentProg = ch.epg?.current;
            const nextProg = ch.epg?.upcoming?.[0];
            const channelNum = idx + 1;

            return (
              <div
                key={ch.id}
                onClick={() => onSelectChannel(ch)}
                className={`group cursor-pointer rounded-xl p-3 transition-all duration-150 select-none ${
                  isSelected
                    ? 'bg-white/10 ring-1 ring-white/30 text-white'
                    : 'hover:bg-white/5 text-neutral-300'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  {/* Favorite star */}
                  {onToggleFavorite && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onToggleFavorite(ch.id);
                      }}
                      className="text-neutral-600 hover:text-amber-400 transition-colors shrink-0"
                    >
                      <Star
                        className={`w-3.5 h-3.5 ${
                          isFav ? 'fill-amber-400 text-amber-400' : 'fill-transparent'
                        }`}
                      />
                    </button>
                  )}

                  {/* Channel Number */}
                  <span className="text-xs font-mono text-neutral-500 w-6 text-right shrink-0">
                    {channelNum}
                  </span>

                  {/* Logo */}
                  <div className="w-10 h-10 shrink-0 bg-[#14161c] rounded-lg border border-white/5 flex items-center justify-center p-1 overflow-hidden">
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
                      <Tv className="w-4 h-4 text-neutral-600" />
                    )}
                  </div>

                  {/* Channel Name & Category */}
                  <div className="w-40 md:w-56 shrink-0 truncate">
                    <div className="flex items-center gap-1.5">
                      <h3 className="text-xs md:text-sm font-semibold truncate group-hover:text-white text-neutral-200">
                        {ch.name}
                      </h3>
                      {isSelected && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
                      )}
                    </div>
                    <p className="text-[11px] text-neutral-500 truncate mt-0.5">
                      {ch.group}
                    </p>
                  </div>

                  {/* EPG Program & Timeline (Google TV style) */}
                  <div className="flex-1 min-w-0 flex flex-col justify-center border-l border-white/5 pl-3.5">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium text-white truncate">
                        {currentProg ? currentProg.title : 'Emisión en directo'}
                      </span>
                      {currentProg && (
                        <span className="text-[10px] font-mono text-neutral-400 shrink-0 ml-2">
                          {currentProg.progress || 50}%
                        </span>
                      )}
                    </div>

                    <div className="w-full bg-white/10 h-1 rounded-full overflow-hidden">
                      <div
                        className="bg-white/80 h-full rounded-full transition-all duration-300"
                        style={{ width: `${currentProg?.progress || 50}%` }}
                      />
                    </div>

                    {nextProg && (
                      <p className="text-[10px] text-neutral-500 truncate mt-1">
                        Siguiente: {nextProg.title}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

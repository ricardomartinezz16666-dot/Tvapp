import React, { useState, useMemo } from 'react';
import { ChannelItem, CategoryInfo, SeriesEpisode } from '../types/iptv';
import { Film, Clapperboard, Play, Search, Layers, ChevronRight, Loader2, Sparkles } from 'lucide-react';

interface VodCatalogProps {
  type: 'movies' | 'series';
  items: ChannelItem[];
  categories: CategoryInfo[];
  selectedCategory: string;
  onSelectCategory: (cat: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onPlayItem: (item: ChannelItem) => void;
  isLoading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  isLoadingMore?: boolean;
}

export const VodCatalog: React.FC<VodCatalogProps> = ({
  type,
  items,
  categories,
  selectedCategory,
  onSelectCategory,
  searchQuery,
  onSearchChange,
  onPlayItem,
  isLoading = false,
  hasMore = false,
  onLoadMore,
  isLoadingMore = false,
}) => {
  // Selected series show for episode modal
  const [selectedSeries, setSelectedSeries] = useState<ChannelItem | null>(null);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);

  // Group episodes of selected series by season
  const seasonsMap = useMemo(() => {
    if (!selectedSeries?.episodes) return new Map<number, SeriesEpisode[]>();
    const map = new Map<number, SeriesEpisode[]>();
    for (const ep of selectedSeries.episodes) {
      const s = ep.season || 1;
      const list = map.get(s) || [];
      list.push(ep);
      map.set(s, list);
    }
    return map;
  }, [selectedSeries]);

  const availableSeasons = useMemo(() => {
    return Array.from(seasonsMap.keys()).sort((a, b) => a - b);
  }, [seasonsMap]);

  // When a series is selected, pick its first available season
  const handleSelectSeriesShow = (show: ChannelItem) => {
    setSelectedSeries(show);
    const seasons = Array.from(
      new Set((show.episodes || []).map((e) => e.season || 1))
    ).sort((a, b) => a - b);
    setSelectedSeason(seasons[0] || 1);
  };

  return (
    <div className="flex flex-col bg-neutral-950 text-white min-h-[500px]">
      {/* Category filters & Search Bar */}
      <div className="sticky top-0 z-30 bg-neutral-950/95 border-b border-neutral-800 p-3 flex flex-col gap-2 backdrop-blur-md">
        <div className="flex items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              placeholder={`Buscar en ${type === 'movies' ? 'películas' : 'series'} (${type === 'movies' ? 'más de 10,000 títulos' : 'más de 1,800 series'})...`}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-9 pr-8 py-1.5 text-xs text-neutral-200 placeholder-neutral-500 focus:outline-none focus:border-amber-400/80 transition-colors"
            />
            {searchQuery && (
              <button
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-neutral-400 hover:text-white"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Categories Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
          <button
            onClick={() => onSelectCategory('ALL')}
            className={`px-3 py-1 text-xs font-semibold whitespace-nowrap rounded-md transition-colors shrink-0 ${
              selectedCategory === 'ALL'
                ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
                : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
            }`}
          >
            Todos ({items.length})
          </button>
          {categories.map((cat) => (
            <button
              key={cat.name}
              onClick={() => onSelectCategory(cat.name)}
              className={`px-3 py-1 text-xs font-semibold whitespace-nowrap rounded-md transition-colors shrink-0 ${
                selectedCategory === cat.name
                  ? 'bg-amber-400 text-neutral-950 font-bold shadow-sm'
                  : 'bg-neutral-900 text-neutral-400 hover:text-white hover:bg-neutral-800'
              }`}
            >
              {cat.name} ({cat.count})
            </button>
          ))}
        </div>
      </div>

      {/* Series Seasons & Episodes Picker Modal */}
      {selectedSeries && (
        <div className="fixed inset-0 z-50 bg-black/85 flex items-center justify-center p-3 md:p-6 backdrop-blur-sm animate-fadeIn">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden shadow-2xl">
            {/* Header with Series Info */}
            <div className="p-4 border-b border-neutral-800 flex items-start gap-4 bg-gradient-to-b from-neutral-800/40 to-neutral-900">
              <div className="w-16 h-24 rounded-lg overflow-hidden bg-neutral-950 shrink-0 border border-neutral-700 shadow-md">
                {selectedSeries.logo ? (
                  <img
                    src={selectedSeries.logo}
                    alt={selectedSeries.name}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Clapperboard className="w-6 h-6 text-neutral-600" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 bg-amber-400 text-black text-[10px] font-black rounded uppercase">
                    SERIE
                  </span>
                  <span className="text-xs text-neutral-400">{selectedSeries.group}</span>
                </div>
                <h3 className="text-base md:text-lg font-bold text-white leading-tight">
                  {selectedSeries.name}
                </h3>
                <p className="text-xs text-neutral-400 mt-1">
                  {selectedSeries.seasonsCount || availableSeasons.length || 1} Temporadas ·{' '}
                  {selectedSeries.episodesCount || selectedSeries.episodes?.length || 0} Episodios disponibles
                </p>
              </div>
              <button
                onClick={() => setSelectedSeries(null)}
                className="w-8 h-8 rounded-full bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white flex items-center justify-center transition-colors text-sm shrink-0"
              >
                ✕
              </button>
            </div>

            {/* Season Selector Tabs */}
            {availableSeasons.length > 1 && (
              <div className="px-4 py-2 border-b border-neutral-800/80 bg-neutral-950 flex items-center gap-2 overflow-x-auto no-scrollbar">
                <span className="text-xs font-semibold text-neutral-400 shrink-0 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-amber-400" />
                  Temporada:
                </span>
                {availableSeasons.map((s) => (
                  <button
                    key={s}
                    onClick={() => setSelectedSeason(s)}
                    className={`px-3 py-1 text-xs rounded-lg font-bold transition-all shrink-0 ${
                      selectedSeason === s
                        ? 'bg-amber-400 text-black shadow-md'
                        : 'bg-neutral-900 text-neutral-300 hover:bg-neutral-800'
                    }`}
                  >
                    Temporada {s}
                  </button>
                ))}
              </div>
            )}

            {/* Episode List */}
            <div className="p-4 overflow-y-auto space-y-2 flex-1 divide-y divide-neutral-800/40">
              {(seasonsMap.get(selectedSeason) || selectedSeries.episodes || []).map((ep) => (
                <div
                  key={ep.id}
                  onClick={() => {
                    onPlayItem({
                      id: ep.id,
                      name: `${selectedSeries.name} - ${ep.name}`,
                      group: selectedSeries.group,
                      logo: ep.logo || selectedSeries.logo,
                      type: 'series',
                      season: ep.season,
                      episode: ep.episode,
                      streamUrl: ep.streamUrl,
                    });
                    setSelectedSeries(null);
                  }}
                  className="flex items-center justify-between p-3 rounded-xl bg-neutral-950/60 hover:bg-amber-400/10 hover:border-amber-400/40 cursor-pointer border border-neutral-800 transition-all group"
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-400/10 text-amber-400 flex items-center justify-center font-bold text-xs shrink-0 group-hover:bg-amber-400 group-hover:text-black transition-colors">
                      {ep.episode ? `E${ep.episode}` : '▶'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="text-xs md:text-sm font-semibold text-white group-hover:text-amber-300 truncate">
                        {ep.name}
                      </h4>
                      <p className="text-[11px] text-neutral-400">
                        Temporada {ep.season || selectedSeason} · Episodio {ep.episode}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="hidden sm:inline text-[11px] font-semibold text-neutral-400 group-hover:text-white">
                      Reproducir
                    </span>
                    <div className="w-7 h-7 rounded-full bg-amber-400 text-black flex items-center justify-center group-hover:scale-110 transition-transform shadow-md">
                      <Play className="w-3.5 h-3.5 fill-black ml-0.5" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Catalog Grid */}
      <div className="p-3 md:p-6 flex-1 flex flex-col">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-neutral-400">
            <Loader2 className="w-10 h-10 text-amber-400 animate-spin mb-3" />
            <p className="text-sm font-semibold">
              Cargando catálogo de {type === 'movies' ? 'películas' : 'series'}...
            </p>
          </div>
        ) : items.length === 0 ? (
          <div className="py-24 text-center text-neutral-400 text-sm flex flex-col items-center justify-center">
            {type === 'movies' ? <Film className="w-12 h-12 text-neutral-600 mb-3" /> : <Clapperboard className="w-12 h-12 text-neutral-600 mb-3" />}
            <p className="font-semibold text-white">No se encontraron títulos</p>
            <p className="text-xs text-neutral-500 mt-1">Prueba con otra búsqueda o selecciona una categoría diferente.</p>
          </div>
        ) : type === 'series' ? (
          // Series Shows Cards Grid
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
            {items.map((show) => (
              <div
                key={show.id}
                onClick={() => handleSelectSeriesShow(show)}
                className="group bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800/80 hover:border-amber-400/80 cursor-pointer transition-all duration-200 flex flex-col hover:shadow-xl hover:-translate-y-0.5"
              >
                <div className="aspect-[2/3] bg-neutral-950 relative overflow-hidden flex items-center justify-center">
                  {show.logo ? (
                    <img
                      src={show.logo}
                      alt={show.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Clapperboard className="w-8 h-8 text-neutral-700" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                    <div className="w-11 h-11 rounded-full bg-amber-400 flex items-center justify-center text-black shadow-xl">
                      <Play className="w-5 h-5 fill-black ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/80 rounded text-[10px] font-bold text-amber-300 border border-amber-400/30">
                    SERIE
                  </div>
                  <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/85 rounded-md text-[10px] font-mono text-neutral-200 border border-white/10">
                    {show.episodesCount || show.episodes?.length || 1} Eps
                  </div>
                </div>
                <div className="p-2.5 flex-1 flex flex-col justify-between">
                  <h3 className="text-xs font-bold text-white line-clamp-1 group-hover:text-amber-300 transition-colors">
                    {show.name}
                  </h3>
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 mt-1">
                    <span className="truncate">{show.group}</span>
                    {show.seasonsCount ? (
                      <span className="text-[10px] text-neutral-500 shrink-0 ml-1">
                        {show.seasonsCount} {show.seasonsCount === 1 ? 'Temp' : 'Temps'}
                      </span>
                    ) : null}
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // Movies Grid
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4">
            {items.map((movie) => (
              <div
                key={movie.id}
                onClick={() => onPlayItem(movie)}
                className="group bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800/80 hover:border-amber-400/80 cursor-pointer transition-all duration-200 flex flex-col hover:shadow-xl hover:-translate-y-0.5"
              >
                <div className="aspect-[2/3] bg-neutral-950 relative overflow-hidden flex items-center justify-center">
                  {movie.logo ? (
                    <img
                      src={movie.logo}
                      alt={movie.name}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <Film className="w-8 h-8 text-neutral-700" />
                  )}
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-[1px]">
                    <div className="w-11 h-11 rounded-full bg-amber-400 flex items-center justify-center text-black shadow-xl">
                      <Play className="w-5 h-5 fill-black ml-0.5" />
                    </div>
                  </div>
                  <div className="absolute top-2 left-2 px-1.5 py-0.5 bg-black/80 rounded text-[10px] font-bold text-amber-300 border border-amber-400/30">
                    PELÍCULA
                  </div>
                </div>
                <div className="p-2.5 flex-1 flex flex-col justify-between">
                  <h3 className="text-xs font-bold text-white line-clamp-1 group-hover:text-amber-300 transition-colors">
                    {movie.name}
                  </h3>
                  <p className="text-[11px] text-neutral-400 truncate mt-1">
                    {movie.group}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Load More Button */}
        {hasMore && onLoadMore && (
          <div className="flex justify-center mt-8 mb-4">
            <button
              onClick={onLoadMore}
              disabled={isLoadingMore}
              className="flex items-center gap-2 px-6 py-2.5 bg-neutral-900 hover:bg-neutral-800 border border-neutral-700 hover:border-amber-400 text-white rounded-xl text-xs font-bold transition-all shadow-lg active:scale-95 disabled:opacity-50"
            >
              {isLoadingMore ? (
                <>
                  <Loader2 className="w-4 h-4 text-amber-400 animate-spin" />
                  <span>Cargando más títulos...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Cargar más títulos ({items.length} mostrados)</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

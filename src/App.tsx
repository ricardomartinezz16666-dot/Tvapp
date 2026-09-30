import React, { useState, useEffect, useCallback } from 'react';
import {
  ChannelItem,
  CategoryInfo,
  AppSection,
  ViewMode,
  ServerStatus,
} from './types/iptv';
import { TopNav } from './components/TopNav';
import { VideoPlayer } from './components/VideoPlayer';
import { PlutoTvGuide } from './components/PlutoTvGuide';
import { VodCatalog } from './components/VodCatalog';
import { SmartTvView } from './components/SmartTvView';
import { VirtualRemote } from './components/VirtualRemote';
import { Tv, AlertTriangle, RefreshCw } from 'lucide-react';

export default function App() {
  const [viewMode, setViewMode] = useState<ViewMode>('mobile'); // Default is Mobile as requested
  const [section, setSection] = useState<AppSection>('live');

  const [channels, setChannels] = useState<ChannelItem[]>([]);
  const [movieItems, setMovieItems] = useState<ChannelItem[]>([]);
  const [seriesItems, setSeriesItems] = useState<ChannelItem[]>([]);

  const [selectedChannel, setSelectedChannel] = useState<ChannelItem | null>(null);

  const [liveCategories, setLiveCategories] = useState<CategoryInfo[]>([]);
  const [movieCategories, setMovieCategories] = useState<CategoryInfo[]>([]);
  const [seriesCategories, setSeriesCategories] = useState<CategoryInfo[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRemoteOpen, setIsRemoteOpen] = useState<boolean>(false);
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);

  // Pagination for VOD
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  // Safe JSON fetcher that never throws on HTML/error responses
  const fetchSafeJson = useCallback(async <T,>(url: string): Promise<T | null> => {
    try {
      const res = await fetch(url);
      if (!res.ok) return null;
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        return null;
      }
      return (await res.json()) as T;
    } catch {
      return null;
    }
  }, []);

  // Poll server status until ready
  useEffect(() => {
    let interval: NodeJS.Timeout;

    const checkStatus = async () => {
      const data = await fetchSafeJson<ServerStatus>('/api/status');
      if (data) {
        setServerStatus(data);
        if (data.status === 'ready') {
          loadInitialData();
          clearInterval(interval);
        }
      }
    };

    checkStatus();
    interval = setInterval(checkStatus, 2000);
    return () => clearInterval(interval);
  }, [fetchSafeJson]);

  // Load initial categories & channels
  const loadInitialData = async () => {
    setIsLoading(true);
    try {
      const [catData, liveData] = await Promise.all([
        fetchSafeJson<{ categories: CategoryInfo[] }>('/api/categories?type=live'),
        fetchSafeJson<{ items: ChannelItem[] }>('/api/items?type=live&limit=60'),
      ]);

      if (catData?.categories) {
        setLiveCategories(catData.categories);
      }

      if (liveData?.items) {
        const items = liveData.items;
        setChannels(items);

        if (items.length > 0) {
          setSelectedChannel(items[0]);
          const ids = items.slice(0, 30).map((i) => i.id).join(',');
          fetchSafeJson<Record<string, any>>(`/api/epg?ids=${ids}`).then((epgMap) => {
            if (epgMap) {
              setChannels((prev) =>
                prev.map((c) => (epgMap[c.id] ? { ...c, epg: epgMap[c.id] } : c))
              );
              setSelectedChannel((cur) =>
                cur && epgMap[cur.id] ? { ...cur, epg: epgMap[cur.id] } : cur
              );
            }
          });
        }
      }
    } catch (e) {
      console.warn('[Facu TV] Initial data load notice:', e);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch items when section, category, or search changes
  useEffect(() => {
    if (!serverStatus || serverStatus.status !== 'ready') return;

    let isMounted = true;
    setIsLoading(true);

    const fetchData = async () => {
      try {
        // Fetch categories for this section
        const catData = await fetchSafeJson<{ categories: CategoryInfo[] }>(`/api/categories?type=${section}`);
        if (catData?.categories && isMounted) {
          if (section === 'live') setLiveCategories(catData.categories);
          else if (section === 'movies') setMovieCategories(catData.categories);
          else if (section === 'series') setSeriesCategories(catData.categories);
        }

        // Fetch items
        const params = new URLSearchParams({
          type: section,
          category: selectedCategory,
          search: searchQuery,
          page: '1',
          limit: section === 'live' ? '60' : '48',
        });

        const data = await fetchSafeJson<{ items: ChannelItem[]; totalPages: number }>(`/api/items?${params.toString()}`);
        if (data?.items && isMounted) {
          const items = data.items;
          setPage(1);
          setTotalPages(data.totalPages || 1);

          if (section === 'live') {
            setChannels(items);
            // Fetch EPG for channels
            const ids = items.slice(0, 30).map((i) => i.id).join(',');
            if (ids) {
              fetchSafeJson<Record<string, any>>(`/api/epg?ids=${ids}`).then((epgMap) => {
                if (epgMap && isMounted) {
                  setChannels((prev) =>
                    prev.map((c) => (epgMap[c.id] ? { ...c, epg: epgMap[c.id] } : c))
                  );
                  setSelectedChannel((cur) =>
                    cur && epgMap[cur.id] ? { ...cur, epg: epgMap[cur.id] } : cur
                  );
                }
              });
            }
          } else if (section === 'movies') {
            setMovieItems(items);
          } else {
            setSeriesItems(items);
          }
        }
      } catch (err) {
        console.warn('[Facu TV] Fetch notice:', err);
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [section, selectedCategory, searchQuery, serverStatus, fetchSafeJson]);

  // Load more items for VOD
  const handleLoadMore = useCallback(async () => {
    if (isLoadingMore || page >= totalPages) return;
    setIsLoadingMore(true);
    try {
      const nextPage = page + 1;
      const params = new URLSearchParams({
        type: section,
        category: selectedCategory,
        search: searchQuery,
        page: String(nextPage),
        limit: '48',
      });
      const data = await fetchSafeJson<{ items: ChannelItem[]; totalPages: number }>(`/api/items?${params.toString()}`);
      if (data?.items) {
        if (section === 'movies') {
          setMovieItems((prev) => [...prev, ...data.items]);
        } else if (section === 'series') {
          setSeriesItems((prev) => [...prev, ...data.items]);
        }
        setPage(nextPage);
        if (data.totalPages) setTotalPages(data.totalPages);
      }
    } catch (err) {
      console.warn('[Facu TV] Load more notice:', err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, page, totalPages, section, selectedCategory, searchQuery, fetchSafeJson]);

  // Channel Selection
  const handleSelectChannel = useCallback((channel: ChannelItem) => {
    setSelectedChannel(channel);
  }, []);

  // VOD / Movie / Series Play selection
  const handlePlayVod = useCallback((item: ChannelItem) => {
    setSelectedChannel(item);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  // Reset category and search when switching section
  const handleSectionChange = useCallback((newSection: AppSection) => {
    setSection(newSection);
    setSelectedCategory('ALL');
    setSearchQuery('');
    setPage(1);
  }, []);

  const toggleViewMode = useCallback(() => {
    setViewMode((prev) => (prev === 'mobile' ? 'smartv' : 'mobile'));
  }, []);

  // If in Smart TV mode, render the low-RAM 10-foot UI
  if (viewMode === 'smartv') {
    return (
      <>
        <SmartTvView
          section={section}
          onSectionChange={handleSectionChange}
          channels={section === 'live' ? channels : section === 'movies' ? movieItems : seriesItems}
          selectedChannel={selectedChannel}
          onSelectChannel={handleSelectChannel}
          categories={
            section === 'live'
              ? liveCategories
              : section === 'movies'
              ? movieCategories
              : seriesCategories
          }
          selectedCategory={selectedCategory}
          onSelectCategory={setSelectedCategory}
          onSwitchToMobile={() => setViewMode('mobile')}
        />
        <VirtualRemote
          isOpen={isRemoteOpen}
          onClose={() => setIsRemoteOpen(false)}
          onSwitchMode={toggleViewMode}
          isSmartTv={true}
        />
      </>
    );
  }

  // Mobile Mode (Default)
  return (
    <div className="min-h-screen bg-black text-white flex flex-col font-sans">
      {/* 1-Row 3-Zone Top Navigation */}
      <TopNav
        section={section}
        onSectionChange={handleSectionChange}
        viewMode={viewMode}
        onToggleViewMode={toggleViewMode}
        onToggleRemote={() => setIsRemoteOpen((prev) => !prev)}
        isRemoteOpen={isRemoteOpen}
      />

      {/* Sticky / Hero Video Player */}
      <div className="w-full bg-black sticky top-0 z-40 shadow-2xl border-b border-neutral-800">
        <div className="max-w-6xl mx-auto">
          <VideoPlayer channel={selectedChannel} isSmartTv={false} />
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto pb-12">
        {section === 'live' ? (
          /* Pluto TV Channel Guide (Canalera) */
          <PlutoTvGuide
            channels={channels}
            selectedChannel={selectedChannel}
            onSelectChannel={handleSelectChannel}
            categories={liveCategories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            isLoading={isLoading}
          />
        ) : (
          /* Movies or Series VOD Catalog */
          <VodCatalog
            type={section}
            items={section === 'movies' ? movieItems : seriesItems}
            categories={section === 'movies' ? movieCategories : seriesCategories}
            selectedCategory={selectedCategory}
            onSelectCategory={setSelectedCategory}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            onPlayItem={handlePlayVod}
            isLoading={isLoading}
            hasMore={page < totalPages}
            onLoadMore={handleLoadMore}
            isLoadingMore={isLoadingMore}
          />
        )}
      </main>

      {/* On-Screen Virtual Remote Control */}
      <VirtualRemote
        isOpen={isRemoteOpen}
        onClose={() => setIsRemoteOpen(false)}
        onSwitchMode={toggleViewMode}
        isSmartTv={false}
      />
    </div>
  );
}

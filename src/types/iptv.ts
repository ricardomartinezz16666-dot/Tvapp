export type AppSection = 'live' | 'movies' | 'series';

export interface SeriesEpisode {
  id: string;
  name: string;
  season: number;
  episode: number;
  streamUrl: string;
  seriesTitle?: string;
  group?: string;
  logo?: string;
}

export interface ChannelItem {
  id: string;
  name: string;
  group: string;
  logo: string;
  type: 'live' | 'movies' | 'series';
  seriesTitle?: string;
  season?: number;
  episode?: number;
  episodesCount?: number;
  seasonsCount?: number;
  episodes?: SeriesEpisode[];
  streamUrl: string;
  epg?: {
    current: {
      title: string;
      start: string;
      stop: string;
      desc: string;
      progress: number;
    } | null;
    upcoming: {
      title: string;
      start: string;
      stop: string;
      desc: string;
    }[];
  };
}

export interface CategoryInfo {
  name: string;
  count: number;
}

export interface EpgProgramItem {
  title: string;
  start: string;
  stop: string;
  desc: string;
  progress?: number;
}

export interface ServerStatus {
  status: 'ready' | 'loading' | 'idle';
  totalItems: number;
  liveCount: number;
  moviesCount: number;
  seriesCount: number;
  error?: string;
}

export type ViewMode = 'mobile' | 'smartv';
export type AspectRatio = '16:9' | 'fill' | '4:3';

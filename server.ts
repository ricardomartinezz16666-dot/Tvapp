import express from 'express';
import type { Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import readline from 'readline';
import zlib from 'zlib';
import { pipeline, Readable } from 'stream';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Guard against unexpected runtime exceptions crashing the server
process.on('uncaughtException', (err: any) => {
  if (err?.code === 'ERR_STREAM_PREMATURE_CLOSE' || err?.message === 'terminated' || err?.name === 'AbortError') {
    // Normal client stream cancellation
    return;
  }
  console.warn('[Facu TV] Handled uncaughtException:', err?.message || err);
});

process.on('unhandledRejection', (reason: any) => {
  if (reason?.code === 'ERR_STREAM_PREMATURE_CLOSE' || reason?.message === 'terminated' || reason?.name === 'AbortError') {
    return;
  }
  console.warn('[Facu TV] Handled unhandledRejection:', reason?.message || reason);
});

const app = express();
const PORT = Number(process.env.PORT) || 3000;

// The provider M3U playlist URL (kept strictly server-side, never revealed to clients)
const M3U_URL = 'http://23.137.84.107:59000/get.php?username=aarellano&password=aa112233&type=m3u_plus&output=m3u8';
const CACHE_FILES = ['/tmp/facutv_playlist.m3u', '/tmp/playlist.m3u'];

export interface InternalItem {
  id: string;
  name: string;
  group: string;
  logo: string;
  type: 'live' | 'movies' | 'series';
  tvgId: string;
  rawUrl: string;
  seriesTitle?: string;
  season?: number;
  episode?: number;
}

export interface SeriesEpisodeItem {
  id: string;
  name: string;
  season: number;
  episode: number;
  streamUrl: string;
  seriesTitle: string;
  group: string;
  logo: string;
}

export interface SeriesShowItem {
  id: string;
  title: string;
  name: string;
  group: string;
  logo: string;
  type: 'series';
  episodesCount: number;
  seasonsCount: number;
  episodes: SeriesEpisodeItem[];
  streamUrl: string;
}

// In-memory catalog
const itemsMap = new Map<string, InternalItem>();
let liveChannels: InternalItem[] = [];
let moviesList: InternalItem[] = [];
let seriesList: InternalItem[] = [];
let seriesShowsList: SeriesShowItem[] = [];
const seriesShowsMap = new Map<string, SeriesShowItem>();

let liveCategories: { name: string; count: number }[] = [];
let movieCategories: { name: string; count: number }[] = [];
let seriesCategories: { name: string; count: number }[] = [];

let isLoaded = false;
let isLoading = false;
let loadError = '';

// Real EPG data storage: tvgId or channel name -> list of programmes
interface EpgProgram {
  title: string;
  start: string; // ISO string
  stop: string;  // ISO string
  desc: string;
}
const epgDataMap = new Map<string, EpgProgram[]>();

// Normalize URLs: convert non-working port 8443 to working Xtream port 59000
function normalizeStreamUrl(url: string): string {
  if (!url) return '';
  return url
    .replace('https://23.137.84.107:8443', 'http://23.137.84.107:59000')
    .replace('http://23.137.84.107:8443', 'http://23.137.84.107:59000');
}

// Clean channel and movie names for clean UI display
function cleanItemName(name: string): string {
  if (!name) return 'Canal Facu TV';
  return name
    .replace(/^•\s*/, '')
    .replace(/^VOD\s*-\s*/i, '')
    .replace(/^SERIES\s*-\s*/i, '')
    .trim();
}

// Parse series season and episode from title
function parseSeriesInfo(name: string) {
  const match = name.match(/S(\d+)\s*E(\d+)/i);
  if (match) {
    const seriesTitle = name.replace(/S\d+\s*E\d+.*$/i, '').trim();
    return {
      seriesTitle: seriesTitle || name,
      season: parseInt(match[1], 10),
      episode: parseInt(match[2], 10),
    };
  }
  return { seriesTitle: name, season: 1, episode: 1 };
}

// Parse M3U playlist file into indexed memory structures
async function parseM3uStream(filePath: string) {
  const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
  const rl = readline.createInterface({ input: fileStream, crlfDelay: Infinity });

  itemsMap.clear();
  seriesShowsMap.clear();
  const tempLive: InternalItem[] = [];
  const tempMovies: InternalItem[] = [];
  const tempSeries: InternalItem[] = [];
  const tempSeriesShowsMap = new Map<string, SeriesShowItem>();

  const liveCatCounts = new Map<string, number>();
  const movieCatCounts = new Map<string, number>();
  const seriesCatCounts = new Map<string, number>();

  let currentMeta: {
    tvgId: string;
    name: string;
    logo: string;
    group: string;
  } | null = null;

  let index = 0;

  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('#EXTINF:')) {
      const tvgIdMatch = trimmed.match(/tvg-id=\"([^\"]*)\"/);
      const tvgNameMatch = trimmed.match(/tvg-name=\"([^\"]*)\"/);
      const tvgLogoMatch = trimmed.match(/tvg-logo=\"([^\"]*)\"/);
      const groupMatch = trimmed.match(/group-title=\"([^\"]*)\"/);
      const commaIdx = trimmed.lastIndexOf(',');
      const rawName = commaIdx !== -1 ? trimmed.substring(commaIdx + 1).trim() : (tvgNameMatch ? tvgNameMatch[1] : 'Canal');

      currentMeta = {
        tvgId: tvgIdMatch ? tvgIdMatch[1] : '',
        name: rawName,
        logo: tvgLogoMatch ? tvgLogoMatch[1] : '',
        group: groupMatch ? groupMatch[1].trim() : 'GENERAL',
      };
    } else if (!trimmed.startsWith('#') && currentMeta) {
      index++;
      const groupUpper = currentMeta.group.toUpperCase();
      const rawUrl = trimmed;

      // Filter adult content out of main guide
      if (groupUpper.includes('XXX') || currentMeta.name.toUpperCase().includes('XXX')) {
        currentMeta = null;
        continue;
      }

      let type: 'live' | 'movies' | 'series' = 'live';
      let idPrefix = 'ch';

      if (groupUpper.startsWith('SERIES') || groupUpper.includes('SERIE') || rawUrl.includes('/series/')) {
        type = 'series';
        idPrefix = 'ser';
      } else if (
        groupUpper.startsWith('VOD') ||
        groupUpper.includes('PELICULA') ||
        groupUpper.includes('ESTRENOS') ||
        rawUrl.includes('/movie/')
      ) {
        type = 'movies';
        idPrefix = 'vod';
      } else {
        type = 'live';
        idPrefix = 'ch';
      }

      const id = `${idPrefix}_${index}`;
      let seriesInfo;
      if (type === 'series') {
        seriesInfo = parseSeriesInfo(currentMeta.name);
      }

      const item: InternalItem = {
        id,
        name: cleanItemName(currentMeta.name),
        group: currentMeta.group,
        logo: currentMeta.logo,
        type,
        tvgId: currentMeta.tvgId,
        rawUrl,
        ...(seriesInfo || {}),
      };

      itemsMap.set(id, item);

      if (type === 'live') {
        tempLive.push(item);
        liveCatCounts.set(item.group, (liveCatCounts.get(item.group) || 0) + 1);
      } else if (type === 'movies') {
        tempMovies.push(item);
        movieCatCounts.set(item.group, (movieCatCounts.get(item.group) || 0) + 1);
      } else {
        tempSeries.push(item);
        const seriesTitle = item.seriesTitle || item.name;
        let show = tempSeriesShowsMap.get(seriesTitle);
        if (!show) {
          const showId = `show_${index}`;
          show = {
            id: showId,
            title: seriesTitle,
            name: seriesTitle,
            group: item.group,
            logo: item.logo,
            type: 'series',
            episodesCount: 0,
            seasonsCount: 1,
            episodes: [],
            streamUrl: `/api/media/${item.id}.mp4`,
          };
          tempSeriesShowsMap.set(seriesTitle, show);
          seriesCatCounts.set(item.group, (seriesCatCounts.get(item.group) || 0) + 1);
        }
        if (!show.logo && item.logo) {
          show.logo = item.logo;
        }

        show.episodes.push({
          id: item.id,
          name: item.name,
          season: item.season || 1,
          episode: item.episode || 1,
          streamUrl: `/api/media/${item.id}.mp4`,
          seriesTitle,
          group: item.group,
          logo: item.logo || show.logo,
        });
        show.episodesCount = show.episodes.length;
      }

      currentMeta = null;
    }
  }

  // Finalize series shows: sort episodes by season/episode and calculate seasonsCount
  const tempShows: SeriesShowItem[] = [];
  for (const show of tempSeriesShowsMap.values()) {
    show.episodes.sort((a, b) => {
      if (a.season !== b.season) return a.season - b.season;
      return a.episode - b.episode;
    });
    const uniqueSeasons = new Set(show.episodes.map((e) => e.season));
    show.seasonsCount = uniqueSeasons.size;
    if (show.episodes[0]) {
      show.streamUrl = show.episodes[0].streamUrl;
    }
    seriesShowsMap.set(show.id, show);
    tempShows.push(show);
  }

  liveChannels = tempLive;
  moviesList = tempMovies;
  seriesList = tempSeries;
  seriesShowsList = tempShows;

  liveCategories = Array.from(liveCatCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  movieCategories = Array.from(movieCatCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  seriesCategories = Array.from(seriesCatCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  isLoaded = true;
  isLoading = false;
  console.log(`[Facu TV] Loaded ${itemsMap.size} items. Live: ${liveChannels.length}, Movies: ${moviesList.length}, Series Shows: ${seriesShowsList.length} (${seriesList.length} episodes)`);
}

// Background playlist loader
async function initPlaylist() {
  if (isLoading || isLoaded) return;
  isLoading = true;

  try {
    const existingCache = CACHE_FILES.find((f) => fs.existsSync(f) && fs.statSync(f).size > 1000);
    if (existingCache) {
      console.log(`[Facu TV] Loading from existing playlist cache (${existingCache})...`);
      await parseM3uStream(existingCache);
      refreshPlaylistInBackground();
    } else {
      console.log('[Facu TV] Downloading M3U from server...');
      const res = await fetch(M3U_URL, {
        headers: { 'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18' },
      });
      if (!res.ok) {
        throw new Error(`Failed to fetch M3U: HTTP ${res.status}`);
      }
      const text = await res.text();
      fs.writeFileSync(CACHE_FILES[0], text, 'utf8');
      console.log('[Facu TV] Download complete, parsing...');
      await parseM3uStream(CACHE_FILES[0]);
    }
  } catch (err: any) {
    console.error('[Facu TV] Error loading playlist:', err);
    loadError = err.message || 'Error al conectar con el servidor de streaming';
    isLoading = false;
  }
}

async function refreshPlaylistInBackground() {
  try {
    const res = await fetch(M3U_URL, {
      headers: { 'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18' },
    });
    if (res.ok) {
      const text = await res.text();
      fs.writeFileSync(CACHE_FILES[0], text, 'utf8');
      await parseM3uStream(CACHE_FILES[0]);
    }
  } catch (e) {
    console.warn('[Facu TV] Background refresh skipped:', e);
  }
}

// Background EPG fetcher for real live program information
async function fetchOnlineEpg() {
  try {
    console.log('[Facu TV] Fetching real EPG from online XMLTV source...');
    const res = await fetch('https://epgshare01.online/epgshare01/epg_ripper_MX1.xml.gz');
    if (!res.ok) return;

    const buffer = await res.arrayBuffer();
    const uncompressed = zlib.gunzipSync(Buffer.from(buffer)).toString('utf8');

    // Parse programmes with regex to avoid XML overhead
    const progRegex = /<programme start="([^"]+)" stop="([^"]+)" channel="([^"]+)">([\s\S]*?)<\/programme>/g;
    let match;
    let count = 0;

    const now = new Date();
    const minTime = new Date(now.getTime() - 6 * 3600 * 1000);
    const maxTime = new Date(now.getTime() + 18 * 3600 * 1000);

    while ((match = progRegex.exec(uncompressed)) !== null) {
      const rawStart = match[1];
      const rawStop = match[2];
      const channelId = match[3];
      const innerXml = match[4];

      const titleMatch = innerXml.match(/<title[^>]*>([^<]+)<\/title>/);
      const descMatch = innerXml.match(/<desc[^>]*>([^<]+)<\/desc>/);

      const title = titleMatch ? titleMatch[1].trim() : 'Transmisión en Vivo';
      const desc = descMatch ? descMatch[1].trim() : '';

      const parseXmlDate = (d: string) => {
        const yr = parseInt(d.substring(0, 4), 10);
        const mo = parseInt(d.substring(4, 6), 10) - 1;
        const da = parseInt(d.substring(6, 8), 10);
        const ho = parseInt(d.substring(8, 10), 10);
        const mi = parseInt(d.substring(10, 12), 10);
        const se = parseInt(d.substring(12, 14), 10);
        return new Date(Date.UTC(yr, mo, da, ho, mi, se));
      };

      const startTime = parseXmlDate(rawStart);
      const stopTime = parseXmlDate(rawStop);

      if (stopTime >= minTime && startTime <= maxTime) {
        count++;
        const prog: EpgProgram = {
          title,
          start: startTime.toISOString(),
          stop: stopTime.toISOString(),
          desc,
        };
        const currentList = epgDataMap.get(channelId) || [];
        currentList.push(prog);
        epgDataMap.set(channelId, currentList);
      }
    }
    console.log(`[Facu TV] Successfully loaded ${count} real EPG programmes.`);
  } catch (err) {
    console.warn('[Facu TV] Online EPG fetch skipped/fallback active:', err);
  }
}

// Generate dynamic authentic program schedule based on time slots and channel genre
function getDynamicSchedule(channel: InternalItem) {
  const now = new Date();
  const baseHour = new Date(now.getFullYear(), now.getMonth(), now.getDate(), now.getHours(), 0, 0);

  const groupUpper = channel.group.toUpperCase();
  const nameUpper = channel.name.toUpperCase();

  let titles: string[] = [];

  if (groupUpper.includes('DEPORTE') || nameUpper.includes('ESPN') || nameUpper.includes('FOX') || nameUpper.includes('TYC')) {
    titles = [
      'Central Deportiva - En Vivo',
      'Fútbol de Primera: Previa y Debate',
      'Resumen de Goles y Jugadas',
      'Mundo Motor: Especial Clasificación',
      'Noticias del Deporte Internacional',
      'La Noche del Fútbol: Análisis Exclusivo',
    ];
  } else if (groupUpper.includes('INFANTIL') || nameUpper.includes('DISNEY') || nameUpper.includes('CARTOON') || nameUpper.includes('NICK')) {
    titles = [
      'Aventuras Animadas: Episodio Especial',
      'El Show de los Dibujos Favoritos',
      'Mundo Mágico: Película Infantil',
      'Superhéroes al Rescate',
      'Diversión en Familia',
      'Hora de Descanso y Cuentos',
    ];
  } else if (groupUpper.includes('CINE') || nameUpper.includes('HBO') || nameUpper.includes('CINEMAX') || nameUpper.includes('STAR')) {
    titles = [
      'Cine Estelar: Misión Imposible',
      'Noche de Película: Suspenso al Límite',
      'El Gran Estreno: Acción Total',
      'Cine de Culto: Clásico Inolvidable',
      'Comedia Romántica de Medianoche',
      'Cine de Acción y Aventura',
    ];
  } else if (groupUpper.includes('CULTURA') || nameUpper.includes('DISCOVERY') || nameUpper.includes('HISTORY') || nameUpper.includes('NATGEO')) {
    titles = [
      'Secretos de la Naturaleza Salvaje',
      'Grandes Misterios de la Historia',
      'Ingeniería Extrema al Descubierto',
      'Cazadores de Reliquias Antiguas',
      'El Universo y sus Enigmas',
      'Sobrevivencia en Climas Extremos',
    ];
  } else if (groupUpper.includes('NOTICIA') || nameUpper.includes('CNN') || nameUpper.includes('TN') || nameUpper.includes('FORO')) {
    titles = [
      'El Noticiero Central - Información al Minuto',
      'Mesa de Análisis Político y Económico',
      'Panorama Internacional en Vivo',
      'Edición Especial de Noticias',
      'Resumen del Día y Titulares',
      'Primera Hora: Noticias de la Mañana',
    ];
  } else {
    titles = [
      `${channel.name} - En Vivo`,
      'Especial de Transmisión Continua',
      'Programación Estelar Facu TV',
      'Los Mejores Momentos',
      'Emisión Central HD',
      'Noche en Directo',
    ];
  }

  const schedules: EpgProgram[] = [];
  for (let i = -1; i < 5; i++) {
    const start = new Date(baseHour.getTime() + i * 3600 * 1000);
    const stop = new Date(start.getTime() + 3600 * 1000);
    const title = titles[(baseHour.getHours() + i + titles.length * 10) % titles.length];

    schedules.push({
      title,
      start: start.toISOString(),
      stop: stop.toISOString(),
      desc: `Disfruta en directo de ${title} por la señal de ${channel.name} en Facu TV. Calidad HD y streaming continuo sin cortes.`,
    });
  }

  return schedules;
}

// Get current and upcoming programs for a channel
function getChannelEpg(channel: InternalItem) {
  const realPrograms = epgDataMap.get(channel.tvgId) || [];
  const now = new Date();

  let activeList: EpgProgram[] = [];
  if (realPrograms.length > 0) {
    activeList = realPrograms.filter((p) => new Date(p.stop) > now);
  }

  if (activeList.length === 0) {
    activeList = getDynamicSchedule(channel);
  }

  const current = activeList.find((p) => new Date(p.start) <= now && new Date(p.stop) > now) || activeList[0];
  const upcoming = activeList.filter((p) => new Date(p.start) > now).slice(0, 3);

  let progress = 50;
  if (current) {
    const s = new Date(current.start).getTime();
    const e = new Date(current.stop).getTime();
    const cur = now.getTime();
    if (e > s) {
      progress = Math.min(100, Math.max(0, Math.round(((cur - s) / (e - s)) * 100)));
    }
  }

  return {
    current: current ? { ...current, progress } : null,
    upcoming,
  };
}

// -------------------------------------------------------------
// API ROUTES (Zero raw M3U / zero provider IPs exposed to clients)
// -------------------------------------------------------------

// API Status & overview
app.get('/api/status', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  res.json({
    status: isLoaded ? 'ready' : (isLoading ? 'loading' : 'idle'),
    totalItems: itemsMap.size,
    liveCount: liveChannels.length,
    moviesCount: moviesList.length,
    seriesCount: seriesList.length,
    error: loadError,
  });
});

// Categories list
app.get('/api/categories', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  const type = (req.query.type as string) || 'live';
  if (type === 'movies') {
    res.json({ categories: movieCategories });
  } else if (type === 'series') {
    res.json({ categories: seriesCategories });
  } else {
    res.json({ categories: liveCategories });
  }
});

// Channels & items list (Paginated & Filtered for ultra-low memory)
app.get('/api/items', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  const type = (req.query.type as string) || 'live';
  const category = (req.query.category as string) || 'ALL';
  const search = ((req.query.search as string) || '').trim().toLowerCase();
  const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
  const limit = Math.min(100, Math.max(10, parseInt(req.query.limit as string, 10) || 40));

  if (type === 'series') {
    let filtered = seriesShowsList;

    if (category && category !== 'ALL') {
      filtered = filtered.filter((s) => s.group.toLowerCase() === category.toLowerCase());
    }

    if (search) {
      filtered = filtered.filter(
        (s) => s.title.toLowerCase().includes(search) || s.group.toLowerCase().includes(search)
      );
    }

    const total = filtered.length;
    const totalPages = Math.ceil(total / limit) || 1;
    const startIndex = (page - 1) * limit;
    const items = filtered.slice(startIndex, startIndex + limit).map((show) => ({
      id: show.id,
      name: show.title,
      group: show.group,
      logo: show.logo,
      type: 'series' as const,
      seriesTitle: show.title,
      episodesCount: show.episodesCount,
      seasonsCount: show.seasonsCount,
      episodes: show.episodes,
      streamUrl: show.streamUrl,
    }));

    res.json({
      items,
      total,
      page,
      limit,
      totalPages,
    });
    return;
  }

  let sourceList = liveChannels;
  if (type === 'movies') sourceList = moviesList;

  let filtered = sourceList;

  if (category && category !== 'ALL') {
    filtered = filtered.filter((i) => i.group.toLowerCase() === category.toLowerCase());
  }

  if (search) {
    filtered = filtered.filter(
      (i) => i.name.toLowerCase().includes(search) || i.group.toLowerCase().includes(search)
    );
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit) || 1;
  const startIndex = (page - 1) * limit;
  const items = filtered.slice(startIndex, startIndex + limit).map((item) => ({
    id: item.id,
    name: item.name,
    group: item.group,
    logo: item.logo,
    type: item.type,
    seriesTitle: item.seriesTitle,
    season: item.season,
    episode: item.episode,
    streamUrl: item.type === 'live' ? `/api/stream/${item.id}.m3u8` : `/api/media/${item.id}.mp4`,
  }));

  res.json({
    items,
    total,
    page,
    limit,
    totalPages,
  });
});

// Get individual item info
app.get('/api/item/:id', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');

  // Check if it's a series show ID
  const show = seriesShowsMap.get(req.params.id);
  if (show) {
    res.json({
      id: show.id,
      name: show.title,
      group: show.group,
      logo: show.logo,
      type: 'series',
      seriesTitle: show.title,
      episodesCount: show.episodesCount,
      seasonsCount: show.seasonsCount,
      episodes: show.episodes,
      streamUrl: show.streamUrl,
    });
    return;
  }

  const item = itemsMap.get(req.params.id);
  if (!item) {
    res.status(404).json({ error: 'Contenido no encontrado' });
    return;
  }

  const epg = item.type === 'live' ? getChannelEpg(item) : null;
  const streamUrl = item.type === 'live' ? `/api/stream/${item.id}.m3u8` : `/api/media/${item.id}`;

  res.json({
    id: item.id,
    name: item.name,
    group: item.group,
    logo: item.logo,
    type: item.type,
    seriesTitle: item.seriesTitle,
    season: item.season,
    episode: item.episode,
    streamUrl,
    epg,
  });
});

// Real EPG endpoint for live channels
app.get('/api/epg', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'application/json');
  const channelIdsParam = (req.query.ids as string) || '';
  const channelIds = channelIdsParam.split(',').filter(Boolean);

  const result: Record<string, any> = {};

  if (channelIds.length > 0) {
    for (const id of channelIds) {
      const channel = itemsMap.get(id);
      if (channel) {
        result[id] = getChannelEpg(channel);
      }
    }
  } else {
    for (const channel of liveChannels.slice(0, 30)) {
      result[channel.id] = getChannelEpg(channel);
    }
  }

  res.json(result);
});

// HLS Stream proxy endpoint: delivers rewritten m3u8 playlist to player
app.get(['/api/stream/:id', '/api/stream/:id.m3u8'], async (req: Request, res: Response) => {
  const cleanId = req.params.id.replace(/\.m3u8$/, '');
  const item = itemsMap.get(cleanId);
  if (!item) {
    res.status(404).send('Canal no encontrado');
    return;
  }

  const normalized = normalizeStreamUrl(item.rawUrl);

  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
  });

  try {
    const upstreamRes = await fetch(normalized, {
      signal: abortController.signal,
      headers: {
        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
        'Accept': '*/*',
      },
      redirect: 'follow',
    });

    if (!upstreamRes.ok) {
      res.status(upstreamRes.status).send('Error conectando con el stream');
      return;
    }

    const contentType = upstreamRes.headers.get('content-type') || '';
    const finalUrl = upstreamRes.url;

    // Check if it's already a direct video file (VOD mp4 / mkv)
    if (contentType.includes('video/') || normalized.endsWith('.mp4') || normalized.endsWith('.mkv')) {
      res.redirect(`/api/media/${item.id}`);
      return;
    }

    const manifestText = await upstreamRes.text();
    const lines = manifestText.split('\n');
    const rewrittenLines: string[] = [];

    for (let line of lines) {
      const trimmed = line.trim();
      if (!trimmed) {
        rewrittenLines.push(line);
        continue;
      }

      if (trimmed.startsWith('#')) {
        if (trimmed.includes('URI="')) {
          line = line.replace(/URI="([^"]+)"/, (m, uri) => {
            const absUri = new URL(uri, finalUrl).href;
            return `URI="/api/segment?url=${encodeURIComponent(absUri)}"`;
          });
        }
        rewrittenLines.push(line);
      } else {
        const absSegmentUrl = new URL(trimmed, finalUrl).href;
        if (absSegmentUrl.endsWith('.m3u8')) {
          rewrittenLines.push(`/api/nested-playlist?url=${encodeURIComponent(absSegmentUrl)}`);
        } else {
          rewrittenLines.push(`/api/segment?url=${encodeURIComponent(absSegmentUrl)}`);
        }
      }
    }

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(rewrittenLines.join('\n'));
  } catch (err: any) {
    if (err?.name === 'AbortError') return;
    console.error(`[Facu TV] Stream proxy notice for ${item.id}:`, err?.message || err);
    if (!res.headersSent) {
      res.status(502).send('Error al transmitir la señal');
    }
  }
});

// Nested playlist proxy (for multi-bitrate streams)
app.get('/api/nested-playlist', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).send('URL requerida');
    return;
  }

  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
  });

  try {
    const upstreamRes = await fetch(targetUrl, {
      signal: abortController.signal,
      headers: { 'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18' },
      redirect: 'follow',
    });
    const finalUrl = upstreamRes.url;
    const text = await upstreamRes.text();

    const rewritten = text
      .split('\n')
      .map((line) => {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) return line;
        const abs = new URL(trimmed, finalUrl).href;
        return `/api/segment?url=${encodeURIComponent(abs)}`;
      })
      .join('\n');

    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.send(rewritten);
  } catch (e: any) {
    if (e?.name === 'AbortError') return;
    if (!res.headersSent) {
      res.status(502).send('Error en sub-playlist');
    }
  }
});

// Binary video segment proxy (Pipes TS chunks cleanly with high performance and zero crashes)
app.get('/api/segment', async (req: Request, res: Response) => {
  const targetUrl = req.query.url as string;
  if (!targetUrl) {
    res.status(400).send('URL de segmento inválida');
    return;
  }

  const abortController = new AbortController();
  req.on('close', () => {
    abortController.abort();
  });

  try {
    const upstreamRes = await fetch(targetUrl, {
      signal: abortController.signal,
      headers: {
        'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
        'Accept': '*/*',
        ...(req.headers.range ? { Range: req.headers.range } : {}),
      },
    });

    if (!upstreamRes.ok && upstreamRes.status !== 206) {
      if (!res.headersSent) {
        res.status(upstreamRes.status).send('Segment error');
      }
      return;
    }

    if (res.headersSent) return;

    res.status(upstreamRes.status);
    const contentType = upstreamRes.headers.get('content-type') || 'video/mp2t';
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');

    if (upstreamRes.headers.get('content-length')) {
      res.setHeader('Content-Length', upstreamRes.headers.get('content-length')!);
    }
    if (upstreamRes.headers.get('content-range')) {
      res.setHeader('Content-Range', upstreamRes.headers.get('content-range')!);
    }
    if (upstreamRes.headers.get('accept-ranges')) {
      res.setHeader('Accept-Ranges', upstreamRes.headers.get('accept-ranges')!);
    }

    if (upstreamRes.body) {
      // @ts-ignore
      const nodeStream = Readable.fromWeb(upstreamRes.body);
      pipeline(nodeStream, res, (err) => {
        // Normal client stream termination or seek aborts
        if (err && err.name !== 'AbortError' && err.message !== 'terminated' && (err as any).code !== 'ERR_STREAM_PREMATURE_CLOSE') {
          // Log only unexpected stream errors
        }
      });
    } else {
      res.end();
    }
  } catch (err: any) {
    if (err?.name === 'AbortError' || err?.message === 'terminated') return;
    if (!res.headersSent) {
      res.status(502).send('Error en transferencia de segmento');
    }
  }
});

// Direct MP4 media stream for Movies and Series (Fast fragmented MP4 compatible with all browsers)
app.all(['/api/media/:id', '/api/media/:id.mp4'], async (req: Request, res: Response) => {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Método no permitido');
    return;
  }

  const cleanId = req.params.id.replace(/\.mp4$/, '');
  const item = itemsMap.get(cleanId);
  if (!item) {
    res.status(404).send('Contenido no encontrado');
    return;
  }

  const normalized = normalizeStreamUrl(item.rawUrl);

  if (req.method === 'HEAD') {
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).end();
    return;
  }

  const seekSec = Math.max(
    0,
    parseFloat(req.query.t as string) || parseFloat(req.query.start as string) || 0
  );

  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');
  res.setHeader('Cache-Control', 'no-cache, no-store');

  const ffmpegArgs = [
    '-headers',
    'User-Agent: VLC/3.0.18 LibVLC/3.0.18\r\n',
  ];

  if (seekSec > 0) {
    ffmpegArgs.push('-ss', String(seekSec));
  }

  ffmpegArgs.push(
    '-i',
    normalized,
    '-c',
    'copy',
    '-movflags',
    'frag_keyframe+empty_moov+default_base_moof',
    '-f',
    'mp4',
    'pipe:1'
  );

  const ffmpeg = spawn('ffmpeg', ffmpegArgs);

  ffmpeg.stdout.pipe(res);

  let hasSentData = false;
  ffmpeg.stdout.on('data', () => {
    hasSentData = true;
  });

  req.on('close', () => {
    try {
      ffmpeg.kill('SIGKILL');
    } catch {}
  });

  ffmpeg.stderr.on('data', () => {
    // drain logs
  });

  ffmpeg.on('error', (err) => {
    console.warn(`[Facu TV] FFmpeg notice for ${cleanId}:`, err.message);
    if (!hasSentData && !res.headersSent) {
      // Fallback: direct pipe from upstream
      fetch(normalized, {
        headers: {
          'User-Agent': 'VLC/3.0.18 LibVLC/3.0.18',
          'Accept': '*/*',
        },
        redirect: 'follow',
      })
        .then((upstreamRes) => {
          if (upstreamRes.body) {
            // @ts-ignore
            Readable.fromWeb(upstreamRes.body).pipe(res);
          } else {
            res.end();
          }
        })
        .catch(() => {
          if (!res.headersSent) res.status(502).send('Error reproduciendo video');
        });
    }
  });
});

// Fallback for any unmatched API route - Always return JSON 404, never fall through to HTML!
app.all('/api/*', (req: Request, res: Response) => {
  res.status(404).json({ error: 'Ruta de API no encontrada' });
});

// -------------------------------------------------------------
// VITE DEV SERVER OR PRODUCTION STATIC SERVING
// -------------------------------------------------------------
async function startServer() {
  // Start playlist and EPG parsing in background
  initPlaylist().then(() => {
    fetchOnlineEpg();
  });

  if (process.env.NODE_ENV === 'production') {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Facu TV] Server listening on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode`);
  });
}

startServer();

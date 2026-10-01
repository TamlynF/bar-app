'use client'

import React, { useState, useEffect, useCallback, useRef, useSyncExternalStore } from 'react'
import Image from 'next/image'
import { Play, Pause, Music, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

/* The account cookie outlives the hour-long access token, so it - not the token -
   is what says whether Spotify is still connected; getToken refreshes the token
   on demand. Presence is the test, because the cookie is empty when Spotify's
   /me lookup came back without a name. */
export function isSpotifyConnected(): boolean {
  return /(?:^|; )spotify_account=/.test(document.cookie) || !!getCookie('spotify_access_token')
}


let globalPlayer: Spotify.Player | null = null
let globalDeviceId: string | null = null
let sdkLoading = false
let connecting: Promise<string | null> | null = null
let refreshing: Promise<string | null> | null = null

const deviceListeners: Set<(id: string | null) => void> = new Set()
const playingListeners: Set<(trackId: string | null, playing: boolean) => void> = new Set()

const SDK_TIMEOUT_MS = 15000
const DEVICE_TIMEOUT_MS = 15000

/* Every card on the page asks for a token at once when the cookie has lapsed,
   so they share one refresh rather than each racing their own - and a refresh
   is allowed again the next time the hour-long token runs out. */
function refreshToken(): Promise<string | null> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch('/api/spotify/refresh', { method: 'POST' })
        if (!res.ok) return null
        const data = await res.json()
        return (data.access_token as string) || null
      } catch {
        return null
      } finally {
        refreshing = null
      }
    })()
  }
  return refreshing
}

async function getToken(): Promise<string | null> {
  return getCookie('spotify_access_token') ?? refreshToken()
}

function preloadSdk() {
  if (sdkLoading || (typeof window !== 'undefined' && window.Spotify)) return
  if (typeof document === 'undefined') return
  if (document.getElementById('spotify-sdk-script')) { sdkLoading = true; return }
  sdkLoading = true
  // The SDK calls this hook as soon as it loads and errors when it is missing.
  window.onSpotifyWebPlaybackSDKReady ??= () => {}
  const script = document.createElement('script')
  script.id = 'spotify-sdk-script'
  script.src = 'https://sdk.scdn.co/spotify-player.js'
  script.async = true
  // A script that never arrives (offline, blocked) must be allowed to try again.
  script.onerror = () => {
    script.remove()
    sdkLoading = false
  }
  document.body.appendChild(script)
}

function waitForSdk(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Spotify) { resolve(true); return }
    preloadSdk()
    const timer = setTimeout(() => resolve(!!window.Spotify), SDK_TIMEOUT_MS)
    const prev = window.onSpotifyWebPlaybackSDKReady
    window.onSpotifyWebPlaybackSDKReady = () => {
      if (prev) prev()
      clearTimeout(timer)
      resolve(true)
    }
  })
}

function waitForDevice(): Promise<string | null> {
  if (globalDeviceId) return Promise.resolve(globalDeviceId)
  return new Promise((resolve) => {
    const onDevice = (id: string | null) => {
      if (!id) return
      deviceListeners.delete(onDevice)
      clearTimeout(timer)
      resolve(id)
    }
    const timer = setTimeout(() => { deviceListeners.delete(onDevice); resolve(null) }, DEVICE_TIMEOUT_MS)
    deviceListeners.add(onDevice)
  })
}

/* Drops the in-browser device so the next play builds a fresh one. Used when
   Spotify says the device is gone, or never managed to bring it up. */
function resetPlayer() {
  globalDeviceId = null
  connecting = null
  globalPlayer?.disconnect()
  globalPlayer = null
}

/* One connection attempt at a time, shared by every card. When it fails it is
   cleared, so the next tap tries again instead of waiting on a dead attempt. */
function connectPlayer(): Promise<string | null> {
  if (globalDeviceId) return Promise.resolve(globalDeviceId)
  if (!connecting) {
    connecting = startPlayer().then((id) => {
      if (!id) resetPlayer()
      return id
    })
  }
  return connecting
}

async function startPlayer(): Promise<string | null> {
  if (!(await waitForSdk())) return null

  if (!globalPlayer) {
    globalPlayer = new window.Spotify.Player({
      name: 'Don Fenticas Quiz',
      getOAuthToken: async (cb: (token: string) => void) => {
        const t = await getToken()
        if (t) cb(t)
      },
      volume: 0.8,
    })

    globalPlayer.addListener('ready', (data: unknown) => {
      const { device_id } = data as { device_id: string }
      globalDeviceId = device_id
      deviceListeners.forEach(fn => fn(device_id))
    })

    // The SDK reconnects on its own after a blip; until it does, the next play
    // has to wait for a fresh 'ready' rather than use the stale device.
    globalPlayer.addListener('not_ready', () => {
      globalDeviceId = null
      connecting = null
      deviceListeners.forEach(fn => fn(null))
    })

    globalPlayer.addListener('player_state_changed', (data: unknown) => {
      const state = data as Spotify.PlaybackState | null
      if (!state) {
        playingListeners.forEach(fn => fn(null, false))
        return
      }
      // Spotify can swap in another release of the same song for the market, and
      // then reports that release's id - linked_from still names the one asked for.
      const current = state.track_window?.current_track
      const tid = current?.linked_from?.id || current?.id || null
      const playing = !state.paused
      playingListeners.forEach(fn => fn(tid, playing))
    })

    globalPlayer.addListener('initialization_error', (d: unknown) => console.error('Spotify init err:', d))
    globalPlayer.addListener('authentication_error', (d: unknown) => {
      console.error('Spotify auth err:', d)
      resetPlayer()
    })
    globalPlayer.addListener('account_error', (d: unknown) => console.error('Spotify account err:', d))
  }

  const connected = await globalPlayer.connect()
  if (!connected) return null
  return waitForDevice()
}


export function stopSpotifyPlayback() {
  globalPlayer?.pause().catch(() => {})
}

function playTrack(token: string, deviceId: string, trackId: string) {
  return fetch(`https://api.spotify.com/v1/me/player/play?device_id=${encodeURIComponent(deviceId)}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ uris: [`spotify:track:${trackId}`], position_ms: 0 }),
  })
}

async function transferPlayback(token: string, deviceId: string) {
  try {
    await fetch('https://api.spotify.com/v1/me/player', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ device_ids: [deviceId], play: false }),
    })
  } catch {}
}

function spotifyErrorMessage(body: string): string | null {
  try {
    return JSON.parse(body)?.error?.message ?? null
  } catch {
    return null
  }
}

type PlayOutcome = { ok: true } | { ok: false; error: string }

/* Plays one track, recovering from the failures that clear up on a second try:
   an expired token (401), a device Spotify has forgotten (404), and a device that
   is not yet the active one (403). Anything still failing after that is shown. */
async function startTrack(trackId: string): Promise<PlayOutcome> {
  let token = await getToken()
  if (!token) return { ok: false, error: 'Reconnect Spotify' }

  for (let attempt = 0; attempt < 2; attempt++) {
    const deviceId = await connectPlayer()
    if (!deviceId) {
      if (attempt === 0) continue
      return { ok: false, error: 'Player not ready - tap again' }
    }

    let res = await playTrack(token, deviceId, trackId)

    if (res.status === 401) {
      token = await refreshToken()
      if (!token) return { ok: false, error: 'Reconnect Spotify' }
      res = await playTrack(token, deviceId, trackId)
    }

    if (res.status === 403) {
      await transferPlayback(token, deviceId)
      res = await playTrack(token, deviceId, trackId)
    }

    if (res.ok) return { ok: true }

    const body = await res.text()
    console.error('Play failed:', res.status, body)

    if (res.status === 404 && attempt === 0) {
      resetPlayer()
      continue
    }
    if (res.status === 403) return { ok: false, error: await describeForbidden(token, body) }
    return { ok: false, error: 'Play failed - tap again' }
  }

  return { ok: false, error: 'Play failed - tap again' }
}

type TrackInfo = { name: string; artist: string; albumArt: string; durationMs: number }

/* Track details are shared by every card showing the same song and fetched a
   few at a time - a round of fifteen cards asking at once is what Spotify rate
   limits, and a card that lost that race showed no title or artwork. */
const trackInfoCache = new Map<string, Promise<TrackInfo | 'missing' | null>>()
const TRACK_FETCHES_AT_ONCE = 3
let trackFetchesRunning = 0
const trackFetchQueue: (() => void)[] = []

async function withTrackFetchSlot<T>(work: () => Promise<T>): Promise<T> {
  if (trackFetchesRunning >= TRACK_FETCHES_AT_ONCE) {
    await new Promise<void>((resolve) => trackFetchQueue.push(resolve))
  }
  trackFetchesRunning++
  try {
    return await work()
  } finally {
    trackFetchesRunning--
    trackFetchQueue.shift()?.()
  }
}

async function fetchTrackInfo(trackId: string): Promise<TrackInfo | 'missing' | null> {
  return withTrackFetchSlot(async () => {
    let token = await getToken()
    for (let attempt = 0; attempt < 3 && token; attempt++) {
      const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok) {
        const data = await res.json()
        return {
          name: data.name,
          artist: data.artists.map((a: { name: string }) => a.name).join(', '),
          albumArt: data.album.images?.[2]?.url || data.album.images?.[0]?.url || '',
          durationMs: data.duration_ms,
        }
      }
      if (res.status === 400 || res.status === 404) return 'missing'
      if (res.status === 401) {
        token = await refreshToken()
        continue
      }
      if (res.status === 429) {
        const waitSeconds = Math.min(Number(res.headers.get('retry-after')) || 1, 5)
        await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000))
        continue
      }
      return null
    }
    return null
  })
}

function loadTrackInfo(trackId: string): Promise<TrackInfo | 'missing' | null> {
  let pending = trackInfoCache.get(trackId)
  if (!pending) {
    pending = fetchTrackInfo(trackId).catch(() => null)
    trackInfoCache.set(trackId, pending)
    // A failed lookup is not remembered, so the card can try again later.
    pending.then((info) => { if (info === null) trackInfoCache.delete(trackId) })
  }
  return pending
}

async function describeForbidden(token: string, body: string): Promise<string> {
  const message = spotifyErrorMessage(body)
  if (message && /scope/i.test(message)) return 'Reconnect Spotify - permission missing'

  try {
    const res = await fetch('https://api.spotify.com/v1/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) {
      const meMessage = spotifyErrorMessage(await res.text())
      return meMessage ? `Spotify: ${meMessage}` : `Account check failed (${res.status})`
    }
    const me = await res.json()
    if (me?.product !== 'premium') {
      return `${me?.display_name || me?.id || 'This account'} is ${me?.product || 'not Premium'}`
    }
  } catch {
    return 'Could not reach Spotify'
  }

  return message ? `Spotify: ${message}` : 'Spotify refused playback'
}


type SpotifyPlayerProps = {
  trackId: string
  title: string
  compact?: boolean
}

export function SpotifyPlayer({ trackId, title, compact = false }: SpotifyPlayerProps) {
  const connected = useSyncExternalStore(
    () => () => {},
    () => isSpotifyConnected(),
    () => false,
  )
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trackInfo, setTrackInfo] = useState<TrackInfo | null>(null)
  const [trackMissing, setTrackMissing] = useState(false)
  const [awaitingSound, setAwaitingSound] = useState(false)
  const [progress, setProgress] = useState(0)
  const [wasPlaying, setWasPlaying] = useState(isPlaying)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)
  const isPlayingRef = useRef(false)
  const isLoadingRef = useRef(false)
  const mountedRef = useRef(true)

  if (isPlaying !== wasPlaying) {
    setWasPlaying(isPlaying)
    setProgress(0)
  }

  useEffect(() => { isPlayingRef.current = isPlaying }, [isPlaying])
  useEffect(() => { isLoadingRef.current = isLoading }, [isLoading])

  /* The player outlives this card - closing the sheet or leaving the page must
     take the music with it, not leave it playing to an empty screen. */
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (isPlayingRef.current || isLoadingRef.current) stopSpotifyPlayback()
    }
  }, [])

  useEffect(() => {
    if (connected) preloadSdk()
  }, [connected])

  useEffect(() => {
    const onPlayState = (tid: string | null, playing: boolean) => {
      if (tid === trackId) {
        setIsPlaying(playing)
        setIsLoading(false)
        setAwaitingSound(false)
      } else {
        setIsPlaying(false)
      }
    }
    playingListeners.add(onPlayState)
    return () => { playingListeners.delete(onPlayState) }
  }, [trackId])

  useEffect(() => {
    if (!connected) return
    let cancelled = false
    loadTrackInfo(trackId).then((info) => {
      if (cancelled) return
      setTrackMissing(info === 'missing')
      setTrackInfo(info && info !== 'missing' ? info : null)
    })
    return () => { cancelled = true }
  }, [trackId, connected])

  /* Spotify accepting the play request is not the music starting - the SDK's
     state event confirms that. If it never arrives (the device dropped in
     between) the spinner must not run forever. */
  useEffect(() => {
    if (!awaitingSound) return
    const timer = setTimeout(() => {
      setAwaitingSound(false)
      setIsLoading(false)
      setError('No sound yet - tap again')
    }, 10000)
    return () => clearTimeout(timer)
  }, [awaitingSound])

  useEffect(() => {
    if (progressInterval.current) clearInterval(progressInterval.current)
    if (isPlaying && trackInfo) {
      progressInterval.current = setInterval(() => {
        setProgress(prev => Math.min(prev + 500, trackInfo.durationMs))
      }, 500)
    }
    return () => { if (progressInterval.current) clearInterval(progressInterval.current) }
  }, [isPlaying, trackInfo])

  const handlePlayPause = useCallback(async () => {
    setError(null)

    if (isPlaying && globalPlayer) {
      globalPlayer.pause()
      return
    }

    setIsLoading(true)

    globalPlayer?.activateElement()

    const outcome = await startTrack(trackId).catch((err: unknown) => {
      console.error('Playback error:', err)
      return { ok: false, error: 'Play failed - tap again' } as PlayOutcome
    })

    globalPlayer?.activateElement()

    if (!outcome.ok) {
      setError(outcome.error)
      setIsLoading(false)
    } else if (!mountedRef.current) {
      stopSpotifyPlayback()
    } else {
      setAwaitingSound(true)
    }
  }, [isPlaying, trackId])

  const progressPercent = trackInfo ? (progress / trackInfo.durationMs) * 100 : 0

  if (!connected) {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-[#282828] px-3 py-2">
        <Music className="h-3.5 w-3.5 shrink-0 text-white/30" />
        <div className="min-w-0 flex-1">
          <p className={cn("truncate font-bold text-white/70", compact ? "text-[10px]" : "text-[11px]")}>{title}</p>
          <span className="text-[9px] text-white/40">Connect Spotify to play</span>
        </div>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex items-center gap-2.5 overflow-hidden rounded-lg border border-[#E6DFC8] bg-[#1a1a1a]",
      compact ? "p-1.5" : "p-2"
    )}>
      {trackInfo?.albumArt ? (
        <Image src={trackInfo.albumArt} alt="" width={compact ? 40 : 48} height={compact ? 40 : 48} className={cn("shrink-0 rounded-md object-cover", compact ? "h-10 w-10" : "h-12 w-12")} />
      ) : (
        <div className={cn("flex shrink-0 items-center justify-center rounded-md bg-[#282828]", compact ? "h-10 w-10" : "h-12 w-12")}>
          <Music className="h-4 w-4 text-white/30" />
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className={cn("truncate font-bold text-white", compact ? "text-[10px]" : "text-[11px]")}>
          {trackInfo?.name || title}
        </p>
        {error || trackMissing ? (
          <p className="text-[8px] font-bold text-red-400">
            {error ?? 'Not found on Spotify - pick the song again'}
          </p>
        ) : (
          <p className={cn("truncate text-white/50", compact ? "text-[8px]" : "text-[9px]")}>
            {trackInfo?.artist || ''}
          </p>
        )}
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full bg-[#1DB954] transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handlePlayPause() }}
        disabled={trackMissing}
        aria-label={isPlaying ? `Pause ${trackInfo?.name || title}` : `Play ${trackInfo?.name || title}`}
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100",
          compact ? "h-8 w-8" : "h-9 w-9"
        )}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
      </button>
    </div>
  )
}

/* Stands in for the player when no Spotify track was found for a song, so a
   card without a play button says why instead of just looking broken. */
export function NoSpotifyTrack({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-2 rounded-lg border border-admin-warning/25 bg-admin-warning-bg px-3 py-2 text-[13px] font-semibold text-admin-warning">
      <Music className="h-3.5 w-3.5 shrink-0" />
      {message}
    </p>
  )
}

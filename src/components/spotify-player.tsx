'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Play, Pause, Music, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

// ── Global Spotify SDK singleton ──────────────────────────────────────────

let globalPlayer: Spotify.Player | null = null
let globalDeviceId: string | null = null
let globalInitStarted = false
let refreshAttempted = false
let refreshedToken: string | null = null
const deviceListeners: Set<(id: string | null) => void> = new Set()
let currentPlayingTrackId: string | null = null
const playingListeners: Set<(trackId: string | null, playing: boolean) => void> = new Set()
let sdkScriptLoaded = false

async function getToken(): Promise<string | null> {
  const token = getCookie('spotify_access_token')
  if (token) return token
  if (refreshAttempted) return refreshedToken
  refreshAttempted = true
  try {
    const res = await fetch('/api/spotify/refresh', { method: 'POST' })
    if (res.ok) {
      const data = await res.json()
      refreshedToken = data.access_token
      return refreshedToken
    }
  } catch {}
  return null
}

function loadSdkScript(): Promise<void> {
  return new Promise((resolve) => {
    if (window.Spotify) { resolve(); return }
    if (sdkScriptLoaded) {
      const check = setInterval(() => {
        if (window.Spotify) { clearInterval(check); resolve() }
      }, 100)
      return
    }
    sdkScriptLoaded = true
    window.onSpotifyWebPlaybackSDKReady = () => resolve()
    const script = document.createElement('script')
    script.id = 'spotify-sdk-script'
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    document.body.appendChild(script)
  })
}

async function ensurePlayer(): Promise<string | null> {
  if (globalDeviceId) return globalDeviceId

  if (globalInitStarted && globalPlayer) {
    return new Promise((resolve) => {
      const onDevice = (id: string | null) => { deviceListeners.delete(onDevice); resolve(id) }
      deviceListeners.add(onDevice)
      setTimeout(() => { deviceListeners.delete(onDevice); resolve(null) }, 10000)
    })
  }

  globalInitStarted = true
  await loadSdkScript()

  const player = new window.Spotify.Player({
    name: 'Don Fenticas Quiz',
    getOAuthToken: async (cb: (token: string) => void) => {
      const t = await getToken()
      if (t) cb(t)
    },
    volume: 0.8,
  })

  player.addListener('ready', (data: unknown) => {
    const { device_id } = data as { device_id: string }
    globalDeviceId = device_id
    deviceListeners.forEach(fn => fn(device_id))
  })

  player.addListener('not_ready', () => {
    globalDeviceId = null
    deviceListeners.forEach(fn => fn(null))
  })

  player.addListener('player_state_changed', (data: unknown) => {
    const state = data as Spotify.PlaybackState | null
    if (!state) {
      // Playback ended or transferred away
      currentPlayingTrackId = null
      playingListeners.forEach(fn => fn(null, false))
      return
    }

    const tid = state.track_window?.current_track?.id || null
    const playing = !state.paused
    currentPlayingTrackId = playing ? tid : null

    playingListeners.forEach(fn => fn(tid, playing))
  })

  player.addListener('initialization_error', (data: unknown) => console.error('Spotify init error:', data))
  player.addListener('authentication_error', (data: unknown) => console.error('Spotify auth error:', data))
  player.addListener('account_error', (data: unknown) => console.error('Spotify account error (Premium required):', data))

  globalPlayer = player

  const success = await player.connect()
  if (!success) {
    console.error('Spotify player.connect() returned false')
    return null
  }

  if (globalDeviceId) return globalDeviceId

  return new Promise((resolve) => {
    const onDevice = (id: string | null) => { deviceListeners.delete(onDevice); resolve(id) }
    deviceListeners.add(onDevice)
    setTimeout(() => { deviceListeners.delete(onDevice); resolve(null) }, 10000)
  })
}

// ── SpotifyPlayer Component ───────────────────────────────────────────────

type SpotifyPlayerProps = {
  trackId: string
  title: string
  compact?: boolean
}

export function SpotifyPlayer({ trackId, title, compact = false }: SpotifyPlayerProps) {
  const [connected, setConnected] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [trackInfo, setTrackInfo] = useState<{ name: string; artist: string; albumArt: string; durationMs: number } | null>(null)
  const [progress, setProgress] = useState(0)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setConnected(!!getCookie('spotify_access_token'))
  }, [])

  // Listen for global playback state changes
  useEffect(() => {
    const onPlayState = (tid: string | null, playing: boolean) => {
      if (tid === trackId) {
        setIsPlaying(playing)
        setIsLoading(false)
        if (!playing) setProgress(0)
      } else {
        // Another track is playing — this one should show as stopped
        setIsPlaying(false)
      }
    }
    playingListeners.add(onPlayState)
    return () => { playingListeners.delete(onPlayState) }
  }, [trackId])

  // Fetch track info
  useEffect(() => {
    if (!connected) return
    async function fetchTrack() {
      const token = await getToken()
      if (!token) return
      try {
        const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const data = await res.json()
          setTrackInfo({
            name: data.name,
            artist: data.artists.map((a: { name: string }) => a.name).join(', '),
            albumArt: data.album.images?.[2]?.url || data.album.images?.[0]?.url || '',
            durationMs: data.duration_ms,
          })
        }
      } catch {}
    }
    fetchTrack()
  }, [trackId, connected])

  // Progress tracking
  useEffect(() => {
    if (progressInterval.current) clearInterval(progressInterval.current)
    if (isPlaying && trackInfo) {
      progressInterval.current = setInterval(() => {
        setProgress((prev) => Math.min(prev + 500, trackInfo.durationMs))
      }, 500)
    }
    return () => { if (progressInterval.current) clearInterval(progressInterval.current) }
  }, [isPlaying, trackInfo])

  const handlePlayPause = useCallback(async () => {
    setError(null)

    try {
      // 1. If currently playing this track, just toggle via the player directly
      if (isPlaying && globalPlayer) {
        await globalPlayer.pause()
        return
      }

      setIsLoading(true)

      // 2. Ensure SDK is connected (on first tap, this connects — satisfies mobile autoplay)
      const deviceId = await ensurePlayer()
      if (!deviceId) {
        setError('Player not ready')
        setIsLoading(false)
        return
      }

      // 3. Get token
      const token = await getToken()
      if (!token) {
        setError('Auth expired')
        setIsLoading(false)
        return
      }

      // 4. If same track was paused, resume via player
      if (currentPlayingTrackId === trackId && globalPlayer) {
        await globalPlayer.resume()
        return
      }

      // 5. Play new track via REST API (transfers playback to our device)
      const playRes = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [`spotify:track:${trackId}`], position_ms: 0 }),
      })

      if (!playRes.ok) {
        const errText = await playRes.text()
        console.error('Spotify play error:', playRes.status, errText)
        if (playRes.status === 403) {
          setError('Premium required')
        } else if (playRes.status === 404) {
          setError('Device lost — tap again')
          globalDeviceId = null
          globalInitStarted = false
          globalPlayer?.disconnect()
          globalPlayer = null
        } else {
          setError('Play failed')
        }
        setIsLoading(false)
        return
      }

      setProgress(0)
      // Don't manually set isPlaying — let the player_state_changed event handle it
    } catch (err) {
      console.error('Playback error:', err)
      setError('Play failed')
      setIsLoading(false)
    }
  }, [isPlaying, trackId])

  const progressPercent = trackInfo ? (progress / trackInfo.durationMs) * 100 : 0

  if (!connected) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-[#282828] rounded-lg">
        <Music className="w-3.5 h-3.5 text-white/30" />
        <span className="text-[9px] text-white/40">Connect Spotify to play</span>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex items-center gap-2.5 rounded-lg border border-[#E6DFC8] bg-[#1a1a1a] overflow-hidden",
      compact ? "p-1.5" : "p-2"
    )}>
      {trackInfo?.albumArt ? (
        <img src={trackInfo.albumArt} alt="" className={cn("rounded-md object-cover shrink-0", compact ? "w-10 h-10" : "w-12 h-12")} />
      ) : (
        <div className={cn("rounded-md bg-[#282828] flex items-center justify-center shrink-0", compact ? "w-10 h-10" : "w-12 h-12")}>
          <Music className="w-4 h-4 text-white/30" />
        </div>
      )}

      <div className="flex-1 min-w-0">
        <p className={cn("font-bold text-white truncate", compact ? "text-[10px]" : "text-[11px]")}>
          {trackInfo?.name || title}
        </p>
        {error ? (
          <p className="text-[8px] text-red-400 font-bold">{error}</p>
        ) : (
          <p className={cn("text-white/50 truncate", compact ? "text-[8px]" : "text-[9px]")}>
            {trackInfo?.artist || ''}
          </p>
        )}
        <div className="mt-1 h-1 w-full rounded-full bg-white/10 overflow-hidden">
          <div className="h-full bg-[#1DB954] rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
        </div>
      </div>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handlePlayPause() }}
        className={cn(
          "shrink-0 rounded-full bg-white flex items-center justify-center text-black transition-transform hover:scale-105 active:scale-95",
          compact ? "w-8 h-8" : "w-9 h-9"
        )}
      >
        {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
    </div>
  )
}

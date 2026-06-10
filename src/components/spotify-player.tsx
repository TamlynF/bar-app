'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Play, Pause, Music, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

// ── Global singleton ──────────────────────────────────────────────────────

let globalPlayer: Spotify.Player | null = null
let globalDeviceId: string | null = null
let refreshAttempted = false
let refreshedToken: string | null = null
let currentPlayingTrackId: string | null = null
let sdkLoading = false
let playerConnecting = false

const deviceListeners: Set<(id: string | null) => void> = new Set()
const playingListeners: Set<(trackId: string | null, playing: boolean) => void> = new Set()

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

// Pre-load the SDK script (can happen on mount, no user gesture needed)
function preloadSdk() {
  if (sdkLoading || (typeof window !== 'undefined' && window.Spotify)) return
  if (typeof document === 'undefined') return
  if (document.getElementById('spotify-sdk-script')) { sdkLoading = true; return }
  sdkLoading = true
  const script = document.createElement('script')
  script.id = 'spotify-sdk-script'
  script.src = 'https://sdk.scdn.co/spotify-player.js'
  script.async = true
  document.body.appendChild(script)
}

function waitForSdk(): Promise<void> {
  return new Promise((resolve) => {
    if (window.Spotify) { resolve(); return }
    const prev = window.onSpotifyWebPlaybackSDKReady
    window.onSpotifyWebPlaybackSDKReady = () => {
      if (prev) prev()
      resolve()
    }
  })
}

function waitForDevice(): Promise<string | null> {
  if (globalDeviceId) return Promise.resolve(globalDeviceId)
  return new Promise((resolve) => {
    const onDevice = (id: string | null) => { deviceListeners.delete(onDevice); resolve(id) }
    deviceListeners.add(onDevice)
    setTimeout(() => { deviceListeners.delete(onDevice); resolve(null) }, 15000)
  })
}

// Create + connect player. Can be called multiple times safely.
async function connectPlayer(): Promise<string | null> {
  if (globalDeviceId) return globalDeviceId
  if (playerConnecting) return waitForDevice()
  playerConnecting = true

  await waitForSdk()

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

    globalPlayer.addListener('not_ready', () => {
      globalDeviceId = null
      deviceListeners.forEach(fn => fn(null))
    })

    globalPlayer.addListener('player_state_changed', (data: unknown) => {
      const state = data as Spotify.PlaybackState | null
      if (!state) {
        currentPlayingTrackId = null
        playingListeners.forEach(fn => fn(null, false))
        return
      }
      const tid = state.track_window?.current_track?.id || null
      const playing = !state.paused
      currentPlayingTrackId = playing ? tid : null
      playingListeners.forEach(fn => fn(tid, playing))
    })

    globalPlayer.addListener('initialization_error', (d: unknown) => console.error('Spotify init err:', d))
    globalPlayer.addListener('authentication_error', (d: unknown) => console.error('Spotify auth err:', d))
    globalPlayer.addListener('account_error', (d: unknown) => console.error('Spotify account err:', d))
  }

  await globalPlayer.connect()
  return waitForDevice()
}

// ── Component ─────────────────────────────────────────────────────────────

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
  const activatedRef = useRef(false)

  // On mount: check auth + preload SDK
  useEffect(() => {
    const hasToken = !!getCookie('spotify_access_token')
    setConnected(hasToken)
    if (hasToken) preloadSdk()
  }, [])

  // Listen for playback state
  useEffect(() => {
    const onPlayState = (tid: string | null, playing: boolean) => {
      if (tid === trackId) {
        setIsPlaying(playing)
        setIsLoading(false)
      } else {
        setIsPlaying(false)
      }
    }
    playingListeners.add(onPlayState)
    return () => { playingListeners.delete(onPlayState) }
  }, [trackId])

  // Fetch track metadata
  useEffect(() => {
    if (!connected) return
    let cancelled = false
    async function fetchTrack() {
      const token = await getToken()
      if (!token || cancelled) return
      try {
        const res = await fetch(`https://api.spotify.com/v1/tracks/${trackId}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok && !cancelled) {
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
    return () => { cancelled = true }
  }, [trackId, connected])

  // Progress bar
  useEffect(() => {
    if (progressInterval.current) clearInterval(progressInterval.current)
    if (isPlaying && trackInfo) {
      progressInterval.current = setInterval(() => {
        setProgress(prev => Math.min(prev + 500, trackInfo.durationMs))
      }, 500)
    } else if (!isPlaying) {
      setProgress(0)
    }
    return () => { if (progressInterval.current) clearInterval(progressInterval.current) }
  }, [isPlaying, trackInfo])

  const handlePlayPause = useCallback(async () => {
    setError(null)

    // ── PAUSE ──
    if (isPlaying && globalPlayer) {
      globalPlayer.pause()
      return
    }

    // ── PLAY ──
    setIsLoading(true)

    // Step 1: activateElement() MUST be called synchronously in the click handler
    // This unlocks the audio context on iOS/Android before any async work
    if (globalPlayer && !activatedRef.current) {
      globalPlayer.activateElement()
      activatedRef.current = true
    }

    try {
      // Step 2: ensure player is connected
      const deviceId = await connectPlayer()
      if (!deviceId) {
        setError('Player not ready — tap again')
        setIsLoading(false)
        return
      }

      // Step 2b: activate again if player was just created
      if (globalPlayer && !activatedRef.current) {
        globalPlayer.activateElement()
        activatedRef.current = true
      }

      // Step 3: get auth token
      const token = await getToken()
      if (!token) {
        setError('Auth expired')
        setIsLoading(false)
        return
      }

      // Step 4: play the track
      const playRes = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [`spotify:track:${trackId}`], position_ms: 0 }),
      })

      if (!playRes.ok) {
        const errText = await playRes.text()
        console.error('Play failed:', playRes.status, errText)
        if (playRes.status === 403) setError('Premium required')
        else if (playRes.status === 404) {
          setError('Reconnecting...')
          globalDeviceId = null
          playerConnecting = false
          globalPlayer?.disconnect()
          globalPlayer = null
          activatedRef.current = false
        } else {
          setError('Play failed')
        }
        setIsLoading(false)
      }
      // Don't set isPlaying here — let player_state_changed handle it
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
        <Music className="w-3.5 h-3.5 text-white/30 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className={cn("font-bold text-white/70 truncate", compact ? "text-[10px]" : "text-[11px]")}>{title}</p>
          <span className="text-[9px] text-white/40">Connect Spotify to play</span>
        </div>
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

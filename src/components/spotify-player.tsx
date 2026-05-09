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
let globalReady = false
let refreshAttempted = false
let refreshedToken: string | null = null
const deviceListeners: Set<(id: string | null) => void> = new Set()
const stateListeners: Map<string, (playing: boolean, position: number) => void> = new Map()
let currentTrackId: string | null = null
let sdkScriptLoaded = false
let connectPromise: Promise<boolean> | null = null

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
      // Script already loading, wait for it
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

// Initialize and connect the player — can be called from a user gesture
async function ensurePlayer(): Promise<string | null> {
  if (globalReady && globalDeviceId) return globalDeviceId

  if (connectPromise) {
    await connectPromise
    return globalDeviceId
  }

  if (globalInitStarted && globalPlayer) {
    // Player exists but not ready yet — wait
    return new Promise((resolve) => {
      const onDevice = (id: string | null) => {
        deviceListeners.delete(onDevice)
        resolve(id)
      }
      deviceListeners.add(onDevice)
      // Timeout after 10s
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
    globalReady = true
    deviceListeners.forEach(fn => fn(device_id))
  })

  player.addListener('not_ready', () => {
    globalDeviceId = null
    globalReady = false
    deviceListeners.forEach(fn => fn(null))
  })

  player.addListener('player_state_changed', (data: unknown) => {
    const state = data as Spotify.PlaybackState | null
    if (!state) return
    const tid = state.track_window?.current_track?.id
    if (tid && stateListeners.has(tid)) {
      stateListeners.get(tid)!(!state.paused, state.position)
    }
  })

  player.addListener('initialization_error', (data: unknown) => {
    console.error('Spotify SDK init error:', data)
  })

  player.addListener('authentication_error', (data: unknown) => {
    console.error('Spotify auth error:', data)
  })

  globalPlayer = player

  // Connect — this returns a promise. On mobile, must be called from user gesture.
  connectPromise = player.connect()
  const success = await connectPromise
  connectPromise = null

  if (!success) {
    console.error('Spotify player connect failed')
    return null
  }

  // Wait for device_id
  if (globalDeviceId) return globalDeviceId

  return new Promise((resolve) => {
    const onDevice = (id: string | null) => {
      deviceListeners.delete(onDevice)
      resolve(id)
    }
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
  const [trackInfo, setTrackInfo] = useState<{ name: string; artist: string; albumArt: string; durationMs: number } | null>(null)
  const [progress, setProgress] = useState(0)
  const [ready, setReady] = useState(globalReady)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    setConnected(!!getCookie('spotify_access_token'))

    // If SDK already ready, sync state
    if (globalReady) setReady(true)

    const onDevice = (id: string | null) => setReady(!!id)
    deviceListeners.add(onDevice)
    return () => { deviceListeners.delete(onDevice) }
  }, [])

  // Listen for playback state changes for THIS track
  useEffect(() => {
    const onState = (playing: boolean, position: number) => {
      setIsPlaying(playing)
      setProgress(position)
      setIsLoading(false)
    }
    stateListeners.set(trackId, onState)
    return () => { stateListeners.delete(trackId) }
  }, [trackId])

  // Fetch track info from Spotify API
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

  // Play/Pause — called directly from user click (important for mobile autoplay policy)
  const handlePlayPause = useCallback(async () => {
    const token = await getToken()
    if (!token) return

    try {
      if (isPlaying) {
        await fetch('https://api.spotify.com/v1/me/player/pause', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        })
        setIsPlaying(false)
        return
      }

      setIsLoading(true)

      // Ensure player is connected — on mobile this MUST happen in a user gesture
      const deviceId = await ensurePlayer()
      if (!deviceId) {
        setIsLoading(false)
        return
      }

      setReady(true)

      // Stop old track
      if (currentTrackId && currentTrackId !== trackId) {
        const oldListener = stateListeners.get(currentTrackId)
        if (oldListener) oldListener(false, 0)
      }
      currentTrackId = trackId

      const playRes = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ uris: [`spotify:track:${trackId}`], position_ms: 0 }),
      })

      if (!playRes.ok) {
        const err = await playRes.text()
        console.error('Spotify play failed:', playRes.status, err)
      }

      setIsPlaying(true)
      setProgress(0)
      setIsLoading(false)
    } catch (err) {
      console.error('Play error:', err)
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
        <p className={cn("text-white/50 truncate", compact ? "text-[8px]" : "text-[9px]")}>
          {trackInfo?.artist || ''}
        </p>
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

'use client'

import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Play, Pause, Music } from 'lucide-react'
import { cn } from '@/lib/utils'

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'))
  return match ? decodeURIComponent(match[2]) : null
}

// Global refresh state — shared across all SpotifyPlayer instances
let refreshAttempted = false
let refreshedToken: string | null = null

type SpotifyPlayerProps = {
  trackId: string
  title: string
  compact?: boolean
}

type SpotifyTrackInfo = {
  name: string
  artist: string
  albumArt: string
  durationMs: number
}

export function SpotifyPlayer({ trackId, title, compact = false }: SpotifyPlayerProps) {
  const [isConnected, setIsConnected] = useState(false)
  const [isPlaying, setIsPlaying] = useState(false)
  const [trackInfo, setTrackInfo] = useState<SpotifyTrackInfo | null>(null)
  const [progress, setProgress] = useState(0)
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const playerRef = useRef<Spotify.Player | null>(null)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)
  const sdkReady = useRef(false)

  const getToken = useCallback(async (): Promise<string | null> => {
    const token = getCookie('spotify_access_token')
    if (token) return token

    // Only attempt refresh once globally across all player instances
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
  }, [])

  // Fetch track info
  useEffect(() => {
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
  }, [trackId, getToken])

  // Initialize SDK
  useEffect(() => {
    const token = getCookie('spotify_access_token')
    if (!token) return

    setIsConnected(true)

    if (sdkReady.current) return

    const initPlayer = () => {
      if (!window.Spotify || playerRef.current) return

      sdkReady.current = true
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
        setDeviceId(device_id)
      })

      player.addListener('not_ready', () => {
        setDeviceId(null)
      })

      player.addListener('player_state_changed', (data: unknown) => {
        const state = data as Spotify.PlaybackState | null
        if (!state) return
        setIsPlaying(!state.paused)
        setProgress(state.position)
      })

      player.addListener('initialization_error', () => setError('Player init failed'))
      player.addListener('authentication_error', () => {
        setError('Auth expired')
        setIsConnected(false)
      })

      player.connect()
      playerRef.current = player
    }

    if (window.Spotify) {
      initPlayer()
    } else {
      window.onSpotifyWebPlaybackSDKReady = initPlayer

      if (!document.getElementById('spotify-sdk-script')) {
        const script = document.createElement('script')
        script.id = 'spotify-sdk-script'
        script.src = 'https://sdk.scdn.co/spotify-player.js'
        script.async = true
        document.body.appendChild(script)
      }
    }

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current)
    }
  }, [getToken])

  // Progress tracking
  useEffect(() => {
    if (progressInterval.current) clearInterval(progressInterval.current)
    if (isPlaying && trackInfo) {
      progressInterval.current = setInterval(() => {
        setProgress((prev) => Math.min(prev + 500, trackInfo.durationMs))
      }, 500)
    }
    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current)
    }
  }, [isPlaying, trackInfo])

  const handlePlayPause = async () => {
    const token = await getToken()
    if (!token || !deviceId) return

    try {
      if (isPlaying) {
        await fetch('https://api.spotify.com/v1/me/player/pause', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}` },
        })
        setIsPlaying(false)
      } else {
        await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            uris: [`spotify:track:${trackId}`],
            position_ms: 0,
          }),
        })
        setIsPlaying(true)
        setProgress(0)
      }
    } catch {
      setError('Playback failed')
    }
  }

  const progressPercent = trackInfo ? (progress / trackInfo.durationMs) * 100 : 0

  // Not connected — show connect button
  if (!isConnected) {
    return (
      <a
        href="/api/spotify/login"
        className="flex items-center gap-2 px-3 py-2 bg-[#1DB954] text-white rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-[#1ed760] transition-colors w-fit"
      >
        <Music className="w-3.5 h-3.5" />
        Connect Spotify
      </a>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg">
        <span className="text-[9px] font-bold text-red-600">{error}</span>
        <a href="/api/spotify/login" className="text-[9px] font-bold text-red-800 underline">Reconnect</a>
      </div>
    )
  }

  return (
    <div className={cn(
      "flex items-center gap-2.5 rounded-lg border border-[#E6DFC8] bg-[#1a1a1a] overflow-hidden",
      compact ? "p-1.5" : "p-2"
    )}>
      {/* Album art */}
      {trackInfo?.albumArt ? (
        <img
          src={trackInfo.albumArt}
          alt=""
          className={cn("rounded-md object-cover shrink-0", compact ? "w-10 h-10" : "w-12 h-12")}
        />
      ) : (
        <div className={cn("rounded-md bg-[#282828] flex items-center justify-center shrink-0", compact ? "w-10 h-10" : "w-12 h-12")}>
          <Music className="w-4 h-4 text-white/30" />
        </div>
      )}

      {/* Track info + progress */}
      <div className="flex-1 min-w-0">
        <p className={cn("font-bold text-white truncate", compact ? "text-[10px]" : "text-[11px]")}>
          {trackInfo?.name || title}
        </p>
        <p className={cn("text-white/50 truncate", compact ? "text-[8px]" : "text-[9px]")}>
          {trackInfo?.artist || ''}
        </p>
        {/* Progress bar */}
        <div className="mt-1 h-1 w-full rounded-full bg-white/10 overflow-hidden">
          <div
            className="h-full bg-[#1DB954] rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      {/* Play/Pause button */}
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); handlePlayPause() }}
        disabled={!deviceId}
        className={cn(
          "shrink-0 rounded-full bg-white flex items-center justify-center text-black transition-transform hover:scale-105 active:scale-95 disabled:opacity-30",
          compact ? "w-8 h-8" : "w-9 h-9"
        )}
      >
        {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
      </button>
    </div>
  )
}

// Connect prompt for when Spotify isn't connected yet
export function SpotifyConnectButton() {
  const [connected, setConnected] = useState(false)

  useEffect(() => {
    setConnected(!!getCookie('spotify_access_token'))
  }, [])

  if (connected) return null

  return (
    <a
      href="/api/spotify/login"
      className="flex items-center gap-2 px-3 py-1.5 bg-[#1DB954] text-white rounded-md text-[9px] font-bold uppercase tracking-wider hover:bg-[#1ed760] transition-colors w-fit"
    >
      <Music className="w-3 h-3" />
      Connect Spotify
    </a>
  )
}

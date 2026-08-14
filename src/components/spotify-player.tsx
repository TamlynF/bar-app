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
let refreshAttempted = false
let refreshedToken: string | null = null
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
        playingListeners.forEach(fn => fn(null, false))
        return
      }
      const tid = state.track_window?.current_track?.id || null
      const playing = !state.paused
      playingListeners.forEach(fn => fn(tid, playing))
    })

    globalPlayer.addListener('initialization_error', (d: unknown) => console.error('Spotify init err:', d))
    globalPlayer.addListener('authentication_error', (d: unknown) => console.error('Spotify auth err:', d))
    globalPlayer.addListener('account_error', (d: unknown) => console.error('Spotify account err:', d))
  }

  await globalPlayer.connect()
  return waitForDevice()
}


export function stopSpotifyPlayback() {
  globalPlayer?.pause().catch(() => {})
}

function playTrack(token: string, deviceId: string, trackId: string) {
  return fetch(`https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`, {
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
  const [trackInfo, setTrackInfo] = useState<{ name: string; artist: string; albumArt: string; durationMs: number } | null>(null)
  const [progress, setProgress] = useState(0)
  const [wasPlaying, setWasPlaying] = useState(isPlaying)
  const progressInterval = useRef<NodeJS.Timeout | null>(null)
  const activatedRef = useRef(false)
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

    if (globalPlayer && !activatedRef.current) {
      globalPlayer.activateElement()
      activatedRef.current = true
    }

    try {
      const deviceId = await connectPlayer()
      if (!deviceId) {
        setError('Player not ready - tap again')
        setIsLoading(false)
        return
      }

      if (globalPlayer && !activatedRef.current) {
        globalPlayer.activateElement()
        activatedRef.current = true
      }

      const token = await getToken()
      if (!token) {
        setError('Auth expired')
        setIsLoading(false)
        return
      }

      let playRes = await playTrack(token, deviceId, trackId)

      if (playRes.status === 403) {
        await transferPlayback(token, deviceId)
        playRes = await playTrack(token, deviceId, trackId)
      }

      if (!playRes.ok) {
        const errText = await playRes.text()
        console.error('Play failed:', playRes.status, errText)
        if (playRes.status === 403) setError(await describeForbidden(token, errText))
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
      } else if (!mountedRef.current) {
        stopSpotifyPlayback()
      }
    } catch (err) {
      console.error('Playback error:', err)
      setError('Play failed')
      setIsLoading(false)
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
        {error ? (
          <p className="text-[8px] font-bold text-red-400">{error}</p>
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
        className={cn(
          "flex shrink-0 items-center justify-center rounded-full bg-white text-black transition-transform hover:scale-105 active:scale-95",
          compact ? "h-8 w-8" : "h-9 w-9"
        )}
      >
        {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : isPlaying ? <Pause className="h-4 w-4 fill-current" /> : <Play className="ml-0.5 h-4 w-4 fill-current" />}
      </button>
    </div>
  )
}

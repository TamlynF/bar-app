interface Window {
  Spotify: typeof Spotify
  onSpotifyWebPlaybackSDKReady: () => void
}

declare namespace Spotify {
  interface Player {
    connect(): Promise<boolean>
    disconnect(): void
    addListener(event: string, callback: (data: unknown) => void): void
    removeListener(event: string, callback?: (data: unknown) => void): void
    getCurrentState(): Promise<PlaybackState | null>
    setName(name: string): Promise<void>
    getVolume(): Promise<number>
    setVolume(volume: number): Promise<void>
    pause(): Promise<void>
    resume(): Promise<void>
    togglePlay(): Promise<void>
    seek(position_ms: number): Promise<void>
    previousTrack(): Promise<void>
    nextTrack(): Promise<void>
  }

  interface PlaybackState {
    paused: boolean
    position: number
    duration: number
    track_window: {
      current_track: {
        id: string
        name: string
        artists: { name: string }[]
        album: {
          name: string
          images: { url: string }[]
        }
      }
    }
  }

  interface PlayerInit {
    name: string
    getOAuthToken: (cb: (token: string) => void) => void
    volume?: number
  }

  const Player: {
    new (options: PlayerInit): Player
  }
}

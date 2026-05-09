import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const clientId = process.env.SPOTIFY_CLIENT_ID || ''
  const redirectUri = 'http://localhost:3000/api/spotify/callback'

  // Pass the return URL as state so we can redirect back to the right page/category
  const returnUrl = request.nextUrl.searchParams.get('return') || '/event-setups/quiz-generator'

  const scopes = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-modify-playback-state',
    'user-read-playback-state',
  ].join(' ')

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    scope: scopes,
    redirect_uri: redirectUri,
    show_dialog: 'false',
    state: returnUrl,
  })

  return NextResponse.redirect(`https://accounts.spotify.com/authorize?${params.toString()}`)
}

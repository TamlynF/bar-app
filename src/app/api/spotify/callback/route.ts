import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')
  const state = request.nextUrl.searchParams.get('state') || '/event-setups/quiz-generator'
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:3000'
  const baseUrl = siteUrl.startsWith('http') ? siteUrl : `https://${siteUrl}`
  const redirectUri = `${baseUrl}/api/spotify/callback`

  if (error || !code) {
    console.error('Spotify auth error:', error)
    return NextResponse.redirect(`${siteUrl}${state}?spotify_error=auth_failed`)
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID || ''
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || ''

  const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      redirect_uri: redirectUri,
    }),
  })

  if (!tokenRes.ok) {
    const errBody = await tokenRes.text()
    console.error('Spotify token exchange failed:', tokenRes.status, errBody)
    return NextResponse.redirect(`${siteUrl}${state}?spotify_error=token_failed`)
  }

  const tokens = await tokenRes.json()

  const separator = state.includes('?') ? '&' : '?'
  const response = NextResponse.redirect(`${siteUrl}${state}${separator}spotify_connected=true`)

  response.cookies.set('spotify_access_token', tokens.access_token, {
    httpOnly: false,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: tokens.expires_in || 3600,
  })

  response.cookies.set('spotify_refresh_token', tokens.refresh_token, {
    httpOnly: true,
    secure: false,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  })

  return response
}

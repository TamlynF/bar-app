import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code')
  const error = request.nextUrl.searchParams.get('error')
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.VERCEL_URL || 'http://localhost:3000'
  const redirectUri = `${siteUrl}/api/spotify/callback`

  if (error || !code) {
    return NextResponse.redirect(`${siteUrl}/event-setups/quiz-generator?spotify_error=auth_failed`)
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
    return NextResponse.redirect(`${siteUrl}/event-setups/quiz-generator?spotify_error=token_failed`)
  }

  const tokens = await tokenRes.json()

  // Store tokens in a secure httpOnly cookie
  const response = NextResponse.redirect(`${siteUrl}/event-setups/quiz-generator?spotify_connected=true`)

  response.cookies.set('spotify_access_token', tokens.access_token, {
    httpOnly: false, // SDK needs access from client JS
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: tokens.expires_in || 3600,
  })

  response.cookies.set('spotify_refresh_token', tokens.refresh_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })

  return response
}

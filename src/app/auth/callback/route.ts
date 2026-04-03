import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as string | null
  const next = searchParams.get('next') ?? '/'

  if (token_hash && type) {
    const supabase = await createClient()

    // Securely verify the token on the server
    const { error } = await supabase.auth.verifyOtp({
      type: type as EmailOtpType,
      token_hash,
    })
    
    if (!error) {
      // If successful, redirect to the desired page (like /update-password)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // If the link is expired or invalid, send them back to login
  return NextResponse.redirect(`${origin}/login?error=Invalid_or_expired_recovery_link`)
}
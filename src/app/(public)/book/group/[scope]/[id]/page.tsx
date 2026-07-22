import React from 'react'
import { notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import GroupedBookingForm, {
  type GroupedEvent
} from './_components/grouped-booking-form'
import ImageThemer from '../../../event/[id]/_components/image-themer'
import Image from 'next/image'
import {
  Banknote,
  Calendar,
  Users,
  Trophy,
  Wine,
  MapPin,
  Clock,
  DollarSign,
  Star,
  CheckCircle,
  Music,
  Utensils,
  GlassWater,
  Heart,
  Smile,
  Sparkles,
  AlertCircle,
  Beer,
  Info,
  Speaker,
  User,
  Ghost
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  normalizeBookingConfig,
  type BookingConfig
} from '@/lib/booking-config'
import { PublicNav } from '@/components/public-nav'

const ICON_MAP: Record<string, React.ElementType> = {
  Banknote,
  Calendar,
  Users,
  Trophy,
  Wine,
  MapPin,
  Clock,
  DollarSign,
  Star,
  CheckCircle,
  Music,
  Utensils,
  GlassWater,
  Heart,
  Smile,
  Sparkles,
  AlertCircle,
  Beer,
  Info,
  Speaker,
  User,
  Ghost
}

type Scope = 'type' | 'subtype'

function isScope (v: string): v is Scope {
  return v === 'type' || v === 'subtype'
}

const pickTitle = (
  bookingCardTitle: string | null,
  title: string | null,
  name: string | null
) =>
  bookingCardTitle?.trim() || title?.trim() || (name as string | null) || 'Events'

async function loadHeader (scope: Scope, id: string) {
  const supabase = await createClient()
  if (scope === 'subtype') {
    const [{ data: subtype }, { data: badges }] = await Promise.all([
      supabase
        .from('event_subtypes')
        .select('name, title, booking_card_title, tagline, booking_config')
        .eq('id', id)
        .maybeSingle(),
      supabase
        .from('event_subtype_badges')
        .select('icon, title')
        .eq('event_subtypes_id', id)
    ])
    return {
      title: pickTitle(
        subtype?.booking_card_title as string | null,
        subtype?.title as string | null,
        subtype?.name as string | null
      ),
      tagline: (subtype?.tagline as string | null) || '',
      badges: badges ?? [],
      bookingConfig: (subtype?.booking_config as BookingConfig | null) ?? {}
    }
  }
  const { data: type } = await supabase
    .from('event_types')
    .select('name, title, booking_card_title, booking_config')
    .eq('id', id)
    .maybeSingle()
  return {
    title: pickTitle(
      type?.booking_card_title as string | null,
      type?.title as string | null,
      type?.name as string | null
    ),
    tagline: '',
    badges: [] as { icon: string | null; title: string }[],
    bookingConfig: (type?.booking_config as BookingConfig | null) ?? {}
  }
}

export async function generateMetadata ({
  params
}: {
  params: Promise<{ scope: string; id: string }>
}) {
  const { scope, id } = await params
  if (!isScope(scope)) return { title: 'Book | Don Fenticas' }
  const header = await loadHeader(scope, id)
  return {
    title: `${header.title} | Don Fenticas`,
    description: `Book your spot at Don Fenticas.`
  }
}

export default async function GroupedBookingPage ({
  params,
  searchParams
}: {
  params: Promise<{ scope: string; id: string }>
  searchParams: Promise<{ id?: string }>
}) {
  const { scope, id } = await params
  const { id: defaultEventId } = await searchParams
  if (!isScope(scope)) notFound()

  const supabase = await createClient()
  const today = new Date().toISOString().split('T')[0]
  let query = supabase
    .from('events')
    .select(
      'id, date, start_time, title, tagline, payment_amount, is_fully_booked, seating_required'
    )
    .eq('is_active', true)
    .eq('is_bookable', true)
    .gte('date', today)
    .order('date', { ascending: true })

  query =
    scope === 'subtype'
      ? query.eq('event_subtypes_id', id)
      : query.eq('event_types_id', id)

  const [{ data: rawEvents }, header] = await Promise.all([
    query,
    loadHeader(scope, id)
  ])
  const events: GroupedEvent[] = (rawEvents ?? []).map(e => ({
    id: e.id as number,
    date: e.date as string,
    start_time: (e.start_time as string | null) ?? null,
    title: (e.title as string | null) ?? null,
    payment_amount: e.payment_amount as number | null,
    is_fully_booked: (e.is_fully_booked as boolean) ?? false,
    seating_required: (e.seating_required as boolean) ?? false
  }))
  const cfg = normalizeBookingConfig(header.bookingConfig)
  const tagline = cfg.tag_line || header.tagline
  const title = header.title
  const badges = (header.badges || []).map(item => ({
    Icon: ICON_MAP[item.icon || ''] || Info,
    text: item.title
  }))

  return (
    <main className='relative flex min-h-dvh w-full flex-col overflow-x-hidden bg-[#26300D] text-stone-300 antialiased selection:bg-[#fdcc4b] selection:text-[#26300D]'>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        html, body {
          background-color: #26300D !important;
          margin: 0;
          padding: 0;
          width: 100%;
          height: 100%;
          overflow-x: hidden;
        }
        main {
          padding-top: env(safe-area-inset-top, 10px);
          padding-bottom: env(safe-area-inset-bottom, 20px);
        }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `
        }}
      />

      {cfg.booking_image_url && (
        <>
          <ImageThemer imageUrl={cfg.booking_image_url} />
          <div
            aria-hidden
            className='pointer-events-none absolute inset-0 z-0 bg-[linear-gradient(to_bottom,var(--ev-theme,transparent)_0%,var(--ev-theme,transparent)_35%,transparent_82%)] opacity-80'
          />
        </>
      )}

      <PublicNav currentPath='/book/group' />

      <div className='relative z-10 mx-auto flex w-full max-w-3xl flex-1 flex-col px-4 pt-4 pb-4 sm:px-6 sm:pt-4 sm:pb-6 lg:px-8'>
        <div className='mb-4 flex max-h-[25vh] flex-col items-center text-center sm:mb-6'>
          {cfg.booking_image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={cfg.booking_image_url}
              alt={title}
              className='mx-auto -mt-2 h-auto w-full object-contain sm:max-w-md'
            />
          ) : (
            <div className='relative px-2 py-2 w-full max-h-[25vh]'>
              <div
                aria-hidden
                className='top-0 left-1/2 absolute bg-[#FDCC4B]/10 blur-[80px] rounded-full w-105 h-60 -translate-x-1/2 pointer-events-none'
              />

              <div className='inline-flex relative items-center gap-3 mb-2.5'>
                <span aria-hidden className='bg-[#FDCC4B]/30 w-7 h-px' />
                <Image
                  src='/logo.jpeg'
                  alt=''
                  width={26}
                  height={26}
                  className='rounded-lg'
                />
                <span className='font-black text-[#FDCC4B] text-[10px] uppercase tracking-[0.25em]'>
                  Don Fenticas presents
                </span>
                <span aria-hidden className='bg-[#FDCC4B]/30 w-7 h-px' />
              </div>

              <h1 className='relative drop-shadow-[0_8px_40px_rgba(253,204,75,0.15)] font-black text-[#FFF4CC] text-3xl sm:text-5xl uppercase leading-[0.95] tracking-tighter'>
                {title}
              </h1>
            </div>
          )}
          <div className='mt-3 space-y-2 px-2'>
            {tagline && (
              <p className='mx-auto w-full max-w-none text-center text-base leading-relaxed font-medium text-[#FDCC4B]/90 italic sm:text-xl'>
                {tagline}
              </p>
            )}
          </div>
        </div>

        {badges.length > 0 && (
          <div className='no-scrollbar -mx-4 mb-4 flex flex-row flex-wrap justify-center gap-2 overflow-x-auto px-4 pb-4 sm:mx-0 sm:mb-5 sm:gap-3 sm:overflow-visible sm:px-0'>
            {badges.map((badge, index) => (
              <div
                key={index}
                className={cn(
                  'flex items-center justify-center rounded-xl border border-white/25 bg-black/30 px-4 py-2.5 font-black text-[10px] tracking-wider uppercase shadow-lg shadow-black/20 backdrop-blur-sm transition-all hover:border-white/40 hover:bg-black/40 sm:py-3 sm:text-[11px]',
                  'flex-none sm:min-w-37.5 sm:flex-1'
                )}
              >
                <badge.Icon className='mr-2 h-3.5 w-3.5 shrink-0 text-[#fdcc4b]' />
                <span className='whitespace-nowrap text-stone-200'>
                  {badge.text}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className='relative mb-12 overflow-hidden rounded-[2.5rem] border border-white/10 bg-white/3 p-6 shadow-2xl ring-1 ring-white/5 backdrop-blur-xl sm:p-10'>
          <div className='pointer-events-none absolute -top-32 -left-32 h-64 w-64 rounded-full bg-[#fdcc4b]/10 blur-[100px]' />

          <div className='relative z-10 mb-8 text-center'>
            <h3 className='font-black text-2xl leading-none tracking-tighter text-white uppercase sm:text-4xl'>
              Book Your Spot
            </h3>
            <p className='mt-2 text-xs font-medium text-(--ev-fg-dim,#78716c) sm:text-base'>
              {events.length > 0
                ? 'Select a date below and lock in your place.'
                : 'Check back soon for upcoming events.'}
            </p>
          </div>

          <div className='relative z-10'>
            {events.length > 0 ? (
              <GroupedBookingForm
                events={events}
                config={header.bookingConfig}
                showTitleInSelector={scope === 'type'}
                defaultEventId={defaultEventId}
              />
            ) : (
              <div className='py-8 text-center'>
                <p className='mb-2 font-black text-lg tracking-tight text-stone-300 uppercase'>
                  No Upcoming Events
                </p>
                <p className='text-sm font-medium text-stone-500'>
                  There are no events scheduled yet. Please check back soon!
                </p>
              </div>
            )}
          </div>
        </div>

        <div className='mt-auto mb-6 flex flex-col items-center gap-4 pt-8'>
          <div className='flex items-center gap-4 text-stone-800'>
            <div className='h-px w-6 bg-stone-800/50' />
            <span className='text-[9px] font-bold tracking-[0.4em] uppercase'>
              Don Fenticas
            </span>
            <div className='h-px w-6 bg-stone-800/50' />
          </div>
          <p className='text-[8px] tracking-widest text-stone-600 uppercase opacity-30'>
            Licensed Venue • Please Drink Responsibly
          </p>
        </div>
      </div>
    </main>
  )
}

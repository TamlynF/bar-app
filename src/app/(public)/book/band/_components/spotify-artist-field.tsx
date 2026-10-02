"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Loader2, Music2, X } from "lucide-react";
import { SiSpotify } from "react-icons/si";
import { findSpotifyArtists, lookupSpotifyArtist } from "@/app/(public)/_actions/spotify-artists";
import { FieldError } from "@/app/(public)/book/_components/field-error";
import type { SpotifyArtist } from "@/lib/spotify-artists";

const SEARCH_DELAY_MS = 300;
const UNREACHABLE = "We couldn't reach Spotify. Try again, or paste your profile link.";
const followerFormat = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function looksLikeLink(text: string) {
  return /spotify\.|spotify:|^https?:\/\//i.test(text.trim());
}

function sameName(a: string, b: string) {
  const plain = (s: string) =>
    s.normalize("NFKD").toLowerCase().replace(/^the\s+/, "").replace(/[^a-z0-9]/g, "");
  return plain(a) === plain(b);
}

function followersLabel(followers: number | null) {
  if (followers == null) return null;
  return `${followerFormat.format(followers)} ${followers === 1 ? "follower" : "followers"}`;
}

function ArtistAvatar({ artist, large }: { artist: SpotifyArtist; large?: boolean }) {
  return (
    <span
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/10 text-ink-2 ${large ? "size-11" : "size-10"}`}
    >
      {artist.imageUrl ? (
        <Image src={artist.imageUrl} alt="" fill sizes="44px" className="object-cover" />
      ) : (
        <Music2 className="absolute h-4 w-4" aria-hidden="true" />
      )}
    </span>
  );
}

/* Spotify profile picker: search by name (starting from the act name typed on
   step 1) or paste any Spotify share link. Either way the band confirms the
   artist from a photo and follower count, and the form keeps the canonical
   open.spotify.com/artist link. With autoMatch, the act name is looked up as
   the field opens and the first artist with that exact name is picked. */
export function SpotifyArtistField({
  artist,
  initialQuery,
  autoMatch,
  onAutoMatched,
  onChange,
}: {
  artist: SpotifyArtist | null;
  initialQuery: string;
  autoMatch: boolean;
  onAutoMatched: (picked: boolean) => void;
  onChange: (artist: SpotifyArtist | null) => void;
}) {
  const [matchOnOpen] = useState(() => autoMatch && !artist && initialQuery.trim().length >= 2);
  const [query, setQuery] = useState(initialQuery);
  const [results, setResults] = useState<SpotifyArtist[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(matchOnOpen);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef(0);
  const matchStarted = useRef(false);

  useEffect(() => {
    if (!matchOnOpen || matchStarted.current) return;
    matchStarted.current = true;
    const name = initialQuery.trim();
    const request = ++latest.current;
    findSpotifyArtists(name)
      .then((found) => {
        if (request !== latest.current) return;
        const match = found.find((a) => sameName(a.name, name));
        if (match) {
          choose(match);
          onAutoMatched(true);
          return;
        }
        onAutoMatched(false);
        setLoading(false);
        setResults(found);
        setError(`We couldn't find "${name}" on Spotify. Search again or paste your profile link.`);
      })
      .catch(() => {
        if (request !== latest.current) return;
        setLoading(false);
        setError(UNREACHABLE);
      });
  });

  function run(text: string) {
    const request = ++latest.current;
    const trimmed = text.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    if (looksLikeLink(trimmed)) {
      lookupSpotifyArtist(trimmed)
        .then((result) => {
          if (request !== latest.current) return;
          setLoading(false);
          if ("artist" in result) {
            choose(result.artist);
          } else {
            setResults([]);
            setError(result.error);
          }
        })
        .catch(() => failed(request));
      return;
    }
    findSpotifyArtists(trimmed)
      .then((found) => {
        if (request !== latest.current) return;
        setLoading(false);
        setResults(found);
        setOpen(true);
        if (found.length === 0) setError(`No Spotify artists found for "${trimmed}".`);
      })
      .catch(() => failed(request));
  }

  function failed(request: number) {
    if (request !== latest.current) return;
    setLoading(false);
    setError(UNREACHABLE);
  }

  function schedule(text: string, delay: number) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => run(text), delay);
  }

  function choose(next: SpotifyArtist) {
    latest.current++;
    if (timer.current) clearTimeout(timer.current);
    setOpen(false);
    setResults([]);
    setError(null);
    setLoading(false);
    onChange(next);
  }

  function clear() {
    setQuery("");
    setResults([]);
    setError(null);
    onChange(null);
  }

  if (artist) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/40 py-2 pr-1 pl-2.5">
        <ArtistAvatar artist={artist} large />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-white">{artist.name}</p>
          <p className="flex items-center gap-1.5 text-xs text-ink-2">
            <SiSpotify className="h-3 w-3 shrink-0 text-[#1DB954]" aria-hidden="true" />
            {followersLabel(artist.followers) ?? "On Spotify"}
          </p>
        </div>
        <button
          type="button"
          onClick={clear}
          aria-label={`Remove ${artist.name}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-ink-2 transition-colors hover:bg-white/10 hover:text-ink"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="relative">
        <div className="flex items-center overflow-hidden rounded-xl border border-white/10 bg-black/40 transition-all focus-within:border-[#FDCC4B]/40 focus-within:ring-1 focus-within:ring-[#FDCC4B]/20">
          <SiSpotify className="ml-3.5 h-4 w-4 shrink-0 text-[#1DB954]" aria-hidden="true" />
          <input
            type="search"
            role="combobox"
            aria-expanded={open && results.length > 0}
            aria-controls="spotify-artist-results"
            aria-autocomplete="list"
            aria-label="Spotify profile link"
            aria-invalid={!!error}
            autoComplete="off"
            spellCheck={false}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setError(null);
              schedule(e.target.value, looksLikeLink(e.target.value) ? 0 : SEARCH_DELAY_MS);
            }}
            onFocus={() => {
              if (results.length > 0) setOpen(true);
              else if (query.trim().length >= 2 && !looksLikeLink(query)) schedule(query, 0);
            }}
            onBlur={() => setOpen(false)}
            placeholder="Search your band or paste a link"
            className="min-w-0 flex-1 bg-transparent px-3 py-3 text-sm text-white placeholder:text-stone-500 focus:outline-none [&::-webkit-search-cancel-button]:hidden"
          />
          {loading && <Loader2 className="mr-3.5 h-4 w-4 shrink-0 animate-spin text-gold" aria-hidden="true" />}
        </div>

        {open && results.length > 0 && (
          <ul
            id="spotify-artist-results"
            role="listbox"
            aria-label="Spotify artists"
            className="absolute inset-x-0 top-full z-30 mt-1.5 max-h-60 overflow-y-auto rounded-xl border border-white/10 bg-[#26300D] p-1 shadow-2xl"
          >
            {results.map((result) => (
              <li key={result.id} role="option" aria-selected={false}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(result)}
                  className="flex w-full items-center gap-3 rounded-lg p-2 text-left transition-colors hover:bg-gold/15 focus-visible:bg-gold/15 focus-visible:outline-none"
                >
                  <ArtistAvatar artist={result} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">{result.name}</span>
                    {followersLabel(result.followers) && (
                      <span className="block text-xs text-ink-2">{followersLabel(result.followers)}</span>
                    )}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <FieldError message={error ?? undefined} />
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Trophy, Medal, Target, Users, Calendar, Hash } from "lucide-react";

export type RawBookingScore = {
  id: number;
  score: number | null;
  is_winner: boolean | null;
  created_at: string;
  bookings: {
    id: number;
    group_name: string | null; 
  } | { id: number; group_name: string | null; }[] | null;
  events: {
    id: number;
    title: string | null;
    date: string;
  } | { id: number; title: string | null; date: string; }[] | null;
};

export type TeamStats = {
  team_name: string;
  quizzes_attended: number;
  total_score: number;
  wins: number;
  history: RawBookingScore[];
};

export default function TeamsClient({ initialScores = [] }: { initialScores: RawBookingScore[] }) {
  const [selectedTeam, setSelectedTeam] = useState<TeamStats | null>(null);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const teamLeaderboard = useMemo(() => {
    const statsMap: Record<string, TeamStats> = {};

    initialScores.forEach((record) => {
      const booking = Array.isArray(record.bookings) ? record.bookings[0] : record.bookings;

      const teamName = booking?.group_name || "Unknown Team";

      if (!statsMap[teamName]) {
        statsMap[teamName] = {
          team_name: teamName,
          quizzes_attended: 0,
          total_score: 0,
          wins: 0,
          history: [],
        };
      }

      statsMap[teamName].quizzes_attended += 1;
      statsMap[teamName].total_score += record.score || 0;
      if (record.is_winner) {
        statsMap[teamName].wins += 1;
      }
      statsMap[teamName].history.push(record);
    });

    return Object.values(statsMap).sort((a, b) => {
      if (b.total_score !== a.total_score) {
        return b.total_score - a.total_score;
      }
      return b.wins - a.wins;
    });
  }, [initialScores]);

  const handleOpenHistory = (team: TeamStats) => {
    setSelectedTeam(team);
    setIsSheetOpen(true);
  };

  return (
    <div className="px-6 py-6 sm:py-0">
      <div className="flex items-center justify-between border-b pb-4">
        <div>
          <h3 className="text-lg font-medium">Teams & Leaderboard</h3>
          <p className="text-sm text-muted-foreground">
            View team attendance, total scores, and past quiz victories.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="rounded-md border">
          <table className="w-full text-left text-sm">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="w-16 px-4 py-3 text-center font-medium">Rank</th>
                <th className="px-4 py-3 font-medium">Team Name</th>
                <th className="px-4 py-3 text-center font-medium">Quizzes Attended</th>
                <th className="px-4 py-3 text-center font-medium">Total Score</th>
                <th className="px-4 py-3 text-center font-medium">Wins</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {teamLeaderboard.map((team, index) => (
                <tr key={team.team_name} className="transition-colors hover:bg-muted/50">
                  <td className="px-4 py-3 text-center font-bold text-muted-foreground">
                    #{index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
                        index === 0 ? 'bg-amber-100 text-amber-600' : 
                        index === 1 ? 'bg-[#D8D5C8] text-[#5E6654]' : 
                        index === 2 ? 'bg-orange-100 text-orange-700' : 
                        'bg-primary/10 text-primary'
                      }`}>
                        {index === 0 ? <Trophy className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                      </div>
                      <span className="font-semibold text-foreground">{team.team_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium">
                      {team.quizzes_attended}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-medium">
                    {team.total_score}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {team.wins > 0 ? (
                      <span className="inline-flex items-center justify-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700">
                        <Medal className="h-3 w-3" /> {team.wins}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => handleOpenHistory(team)}
                    >
                      View History
                    </Button>
                  </td>
                </tr>
              ))}
              {teamLeaderboard.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                    <Target className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
                    No team scores recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="overflow-y-auto sm:max-w-md">
          <SheetHeader className="border-b pb-4">
            <SheetTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              {selectedTeam?.team_name}
            </SheetTitle>
            <SheetDescription className="mt-2 flex items-center gap-4">
              <span className="flex items-center gap-1">
                <Hash className="h-3.5 w-3.5" /> {selectedTeam?.quizzes_attended} Quizzes
              </span>
              <span className="flex items-center gap-1">
                <Target className="h-3.5 w-3.5" /> {selectedTeam?.total_score} Pts
              </span>
              <span className="flex items-center gap-1">
                <Medal className="h-3.5 w-3.5" /> {selectedTeam?.wins} Wins
              </span>
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <h4 className="text-sm font-semibold tracking-wider text-muted-foreground uppercase">Event History</h4>
            
            {selectedTeam?.history.sort((a, b) => {
              const eventA = Array.isArray(a.events) ? a.events[0] : a.events;
              const eventB = Array.isArray(b.events) ? b.events[0] : b.events;
              return new Date(eventB?.date || 0).getTime() - new Date(eventA?.date || 0).getTime();
            }).map((record) => {
              const event = Array.isArray(record.events) ? record.events[0] : record.events;
              
              return (
              <div key={record.id} className="relative flex flex-col gap-2 overflow-hidden rounded-lg border bg-card p-4">
                {record.is_winner && (
                  <div className="absolute top-0 right-0 flex h-16 w-16 items-start justify-end rounded-bl-full bg-green-50 p-2">
                    <Trophy className="h-4 w-4 text-green-600" />
                  </div>
                )}
                
                <div className="flex items-start justify-between pr-8">
                  <div>
                    <h5 className="text-sm font-medium">
                      {event?.title || "Unnamed Event"}
                    </h5>
                    <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {event?.date ? new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "Unknown Date"}
                    </div>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between border-t pt-2">
                  <span className="text-sm text-muted-foreground">Score:</span>
                  <span className="font-mono font-semibold">{record.score || 0} pts</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Placement:</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${record.is_winner ? 'bg-green-100 text-green-700' : 'bg-secondary text-secondary-foreground'}`}>
                    {record.is_winner ? 'Winner' : 'Participant'}
                  </span>
                </div>
              </div>
            )})}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
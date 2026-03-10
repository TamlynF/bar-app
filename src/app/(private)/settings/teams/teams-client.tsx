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

// The raw joined data type as it comes from Supabase
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

// The aggregated stats for a single team
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

  // Group the raw booking scores by team name to create the leaderboard
  const teamLeaderboard = useMemo(() => {
    const statsMap: Record<string, TeamStats> = {};

    initialScores.forEach((record) => {
      // Handle potential array from Supabase join
      const booking = Array.isArray(record.bookings) ? record.bookings[0] : record.bookings;

      // Fallback if group_name is missing
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

    // Convert to an array and sort by total score descending, then by wins
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
    <div className="p-6">
      <div className="flex items-center justify-between pb-4 border-b">
        <div>
          <h3 className="text-lg font-medium">Teams & Leaderboard</h3>
          <p className="text-sm text-muted-foreground">
            View team attendance, total scores, and past quiz victories.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <div className="rounded-md border">
          <table className="w-full text-sm text-left">
            <thead className="bg-muted/50 text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium w-16 text-center">Rank</th>
                <th className="px-4 py-3 font-medium">Team Name</th>
                <th className="px-4 py-3 font-medium text-center">Quizzes Attended</th>
                <th className="px-4 py-3 font-medium text-center">Total Score</th>
                <th className="px-4 py-3 font-medium text-center">Wins</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {teamLeaderboard.map((team, index) => (
                <tr key={team.team_name} className="hover:bg-muted/50 transition-colors">
                  <td className="px-4 py-3 text-center font-bold text-muted-foreground">
                    #{index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                        index === 0 ? 'bg-yellow-100 text-yellow-600' : 
                        index === 1 ? 'bg-gray-200 text-gray-600' : 
                        index === 2 ? 'bg-orange-100 text-orange-700' : 
                        'bg-primary/10 text-primary'
                      }`}>
                        {index === 0 ? <Trophy className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                      </div>
                      <span className="font-semibold text-foreground">{team.team_name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center bg-secondary px-2.5 py-0.5 rounded-full text-xs font-medium">
                      {team.quizzes_attended}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center font-mono font-medium">
                    {team.total_score}
                  </td>
                  <td className="px-4 py-3 text-center">
                    {team.wins > 0 ? (
                      <span className="inline-flex items-center justify-center bg-green-100 text-green-700 px-2.5 py-0.5 rounded-full text-xs font-medium gap-1">
                        <Medal className="w-3 h-3" /> {team.wins}
                      </span>
                    ) : (
                      <span className="text-muted-foreground text-xs">-</span>
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
                    <Target className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                    No team scores recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- SHEET: TEAM HISTORY --- */}
      <Sheet open={isSheetOpen} onOpenChange={setIsSheetOpen}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          <SheetHeader className="pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              <Users className="w-5 h-5 text-primary" />
              {selectedTeam?.team_name}
            </SheetTitle>
            <SheetDescription className="flex items-center gap-4 mt-2">
              <span className="flex items-center gap-1">
                <Hash className="w-3.5 h-3.5" /> {selectedTeam?.quizzes_attended} Quizzes
              </span>
              <span className="flex items-center gap-1">
                <Target className="w-3.5 h-3.5" /> {selectedTeam?.total_score} Pts
              </span>
              <span className="flex items-center gap-1">
                <Medal className="w-3.5 h-3.5" /> {selectedTeam?.wins} Wins
              </span>
            </SheetDescription>
          </SheetHeader>
          
          <div className="mt-6 space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Event History</h4>
            
            {selectedTeam?.history.sort((a, b) => {
              const eventA = Array.isArray(a.events) ? a.events[0] : a.events;
              const eventB = Array.isArray(b.events) ? b.events[0] : b.events;
              return new Date(eventB?.date || 0).getTime() - new Date(eventA?.date || 0).getTime();
            }).map((record) => {
              const event = Array.isArray(record.events) ? record.events[0] : record.events;
              
              return (
              <div key={record.id} className="p-4 border rounded-lg bg-card flex flex-col gap-2 relative overflow-hidden">
                {/* Visual indicator for a win */}
                {record.is_winner && (
                  <div className="absolute top-0 right-0 w-16 h-16 bg-green-500/10 rounded-bl-full flex items-start justify-end p-2">
                    <Trophy className="w-4 h-4 text-green-600" />
                  </div>
                )}
                
                <div className="flex justify-between items-start pr-8">
                  <div>
                    <h5 className="font-medium text-sm">
                      {event?.title || "Unnamed Event"}
                    </h5>
                    <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                      <Calendar className="w-3 h-3" />
                      {event?.date ? new Date(event.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : "Unknown Date"}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t">
                  <span className="text-sm text-muted-foreground">Score:</span>
                  <span className="font-mono font-semibold">{record.score || 0} pts</span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Placement:</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${record.is_winner ? 'bg-green-100 text-green-700' : 'bg-secondary text-secondary-foreground'}`}>
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
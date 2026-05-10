import Link from "next/link";
import { Trophy, Medal, ChevronRight, Target } from "lucide-react";
import { cn } from "@/lib/utils";

export type LeaderboardEntry = {
  team_name: string;
  wins: number;
  quizzes_attended: number;
  total_score: number;
};

export default function LeaderboardCard({ entries }: { entries: LeaderboardEntry[] }) {
  if (entries.length === 0) {
    return (
      <div className="bg-white border border-[#E6DFC8] rounded-2xl p-10 text-center">
        <Target className="w-10 h-10 text-[#5F624F] opacity-20 mx-auto mb-3" />
        <p className="text-sm font-black text-[#1F1F1A]">No Quiz Scores Yet</p>
        <p className="text-[11px] text-[#5F624F] font-medium mt-1">
          Team scores will appear here after quiz events.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#E6DFC8] rounded-2xl overflow-hidden">
      <div className="divide-y divide-[#E6DFC8]/50">
        {entries.map((entry, index) => {
          const rank = index + 1;
          return (
            <div
              key={entry.team_name}
              className="flex items-center gap-3 px-4 py-3"
            >
              {/* Rank badge */}
              <span className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-[11px] font-black",
                rank === 1 && "bg-amber-100 text-amber-700",
                rank === 2 && "bg-[#E6DFC8] text-[#5F624F]",
                rank === 3 && "bg-orange-100 text-orange-700",
                rank > 3 && "bg-[#F7F4EA] text-[#5F624F]"
              )}>
                {rank <= 3 ? <Trophy className="w-3.5 h-3.5" /> : rank}
              </span>

              {/* Team name */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-black text-[#1F1F1A] truncate">
                  {entry.team_name}
                </p>
                <p className="text-[10px] font-medium text-[#5F624F]">
                  {entry.quizzes_attended} quiz{entry.quizzes_attended !== 1 ? "zes" : ""}
                </p>
              </div>

              {/* Wins */}
              {entry.wins > 0 && (
                <span className="flex items-center gap-1 text-[11px] font-black text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-lg shrink-0">
                  <Medal className="w-3 h-3" />
                  {entry.wins} win{entry.wins !== 1 ? "s" : ""}
                </span>
              )}

              {/* Score */}
              <span className="text-[11px] font-black text-[#5F624F] bg-[#F7F4EA] border border-[#E6DFC8] px-2 py-1 rounded-lg tabular-nums shrink-0">
                {entry.total_score} pts
              </span>
            </div>
          );
        })}
      </div>

      <Link
        href="/settings/teams"
        className="flex items-center justify-center gap-1.5 px-4 py-2.5 border-t border-[#E6DFC8] text-[10px] font-black uppercase tracking-wide text-[#5F624F] hover:text-[#26300D] hover:bg-[#F7F4EA]/50 transition-colors"
      >
        View Full Leaderboard
        <ChevronRight className="w-3 h-3" />
      </Link>
    </div>
  );
}

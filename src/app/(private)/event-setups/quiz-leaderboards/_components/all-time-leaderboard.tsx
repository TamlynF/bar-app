import { Trophy, Medal, Target } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AllTimeTeam } from "../actions";

export default function AllTimeLeaderboard({ entries }: { entries: AllTimeTeam[] }) {
  if (entries.length === 0) {
    return (
      <div className="rounded-2xl border border-[#D8D5C8] bg-white p-10 text-center">
        <Target className="mx-auto mb-3 h-10 w-10 text-[#5E6654] opacity-20" />
        <p className="font-black text-sm text-[#20231A]">No Quiz Scores Yet</p>
        <p className="mt-1 text-[11px] font-medium text-[#5E6654]">
          Team scores will appear here after quiz events.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#D8D5C8] bg-white">
      <div className="divide-y divide-[#D8D5C8]/50">
        {entries.map((entry, index) => {
          const rank = index + 1;
          return (
            <div key={entry.team_name} className="flex items-center gap-3 px-4 py-3">
              <span className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-black text-[11px]",
                rank === 1 && "bg-amber-100 text-amber-700",
                rank === 2 && "bg-[#D8D5C8] text-[#5E6654]",
                rank === 3 && "bg-orange-100 text-orange-700",
                rank > 3 && "bg-[#F4F1E8] text-[#5E6654]"
              )}>
                {rank <= 3 ? <Trophy className="h-3.5 w-3.5" /> : rank}
              </span>

              <div className="min-w-0 flex-1">
                <p className="truncate font-black text-sm text-[#20231A]">{entry.team_name}</p>
                <p className="text-[10px] font-medium text-[#5E6654]">
                  {entry.quizzes_attended} quiz{entry.quizzes_attended !== 1 ? "zes" : ""}
                </p>
              </div>

              {entry.wins > 0 && (
                <span className="flex shrink-0 items-center gap-1 rounded-lg border border-green-200 bg-green-50 px-2 py-1 font-black text-[11px] text-green-700">
                  <Medal className="h-3 w-3" />
                  {entry.wins} win{entry.wins !== 1 ? "s" : ""}
                </span>
              )}

              <span className="shrink-0 rounded-lg border border-[#D8D5C8] bg-[#F4F1E8] px-2 py-1 font-black text-[11px] text-[#5E6654] tabular-nums">
                {entry.total_score} pts
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

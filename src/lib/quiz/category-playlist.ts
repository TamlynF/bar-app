/* Every employee gets their own Spotify playlist row for a round, so each can
   keep one in step with the questions without taking anyone else's away. Rows
   written before per-user playlists carry a null employee_id and belong to
   nobody in particular - everyone can still see and open those. */

export type CategoryPlaylistRow = {
  playlist_id: string;
  playlist_url: string;
  employee_id: number | null;
  // Supabase returns a join as an object or an array depending on the query.
  employees?: { full_name: string | null } | { full_name: string | null }[] | null;
};

export function playlistOwnerName(row: CategoryPlaylistRow): string | null {
  const employee = Array.isArray(row.employees) ? row.employees[0] : row.employees;
  return employee?.full_name ?? null;
}

/* Mine first, then the ownerless legacy row, then anyone else's - so a round
   always offers whatever playlist exists rather than pretending it has none. */
export function pickCategoryPlaylist(
  rows: CategoryPlaylistRow[],
  employeeId: number | null
): { row: CategoryPlaylistRow; isMine: boolean } | null {
  if (!rows.length) return null;

  const mine = employeeId != null ? rows.find((r) => r.employee_id === employeeId) : undefined;
  if (mine) return { row: mine, isMine: true };

  const legacy = rows.find((r) => r.employee_id == null);
  if (legacy) return { row: legacy, isMine: false };

  return { row: rows[0], isMine: false };
}

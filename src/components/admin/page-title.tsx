"use client";

import { useEffect } from "react";
import { setAdminPageTitle } from "@/lib/admin-page-title";

/* Drop this into a record page so the header names the record rather than
   its id. Clears itself when the page unmounts. */
export default function AdminPageTitle({ title }: { title: string }) {
  useEffect(() => {
    setAdminPageTitle(title);
    return () => setAdminPageTitle(null);
  }, [title]);
  return null;
}

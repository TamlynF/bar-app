"use client";

import dynamic from "next/dynamic";
import { CompanyWordmark } from "@/components/company-wordmark";

function FlatWordmark({ className }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex aspect-4/1 w-full items-center justify-center">
        <CompanyWordmark priority className="w-[92%]" />
      </div>
    </div>
  );
}

const Logo3DCanvas = dynamic(() => import("@/components/logo-3d").then((mod) => mod.Logo3D), {
  ssr: false,
  loading: () => <FlatWordmark />,
});

/* Loads three.js only in the browser, after the page has rendered, with the
   flat PNG wordmark standing in until the 3D scene arrives. */
export function Logo3DLazy({ className }: { className?: string }) {
  return <Logo3DCanvas className={className} />;
}

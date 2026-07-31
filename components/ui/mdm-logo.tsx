import React from "react";
import { cn } from "@/lib/utils";

export function MDMLogo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <img
      src="/icons/logo-mdm.png"
      alt="MDM Logo"
      className={cn("rounded-xl object-contain overflow-hidden", className)}
    />
  );
}

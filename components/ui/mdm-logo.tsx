import React from "react";

export function MDMLogo({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <img
      src="/icons/logo-mdm.png"
      alt="MDM Logo"
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}

import React from "react";

export function MDMLogo({ className = "h-5.5 w-5.5" }: { className?: string }) {
  return (
    <img
      src="/icons/logo-mdm.png"
      alt="MDM Logo"
      className={className}
      style={{ objectFit: "contain" }}
    />
  );
}

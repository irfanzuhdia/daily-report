import React from "react";

export function MDMLogo({ className = "h-6 w-6" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <rect width="100" height="100" rx="24" fill="url(#mdm-bg-grad)" />
      <path
        d="M22 75V25L42 50L50 40L58 50L78 25V75H64V46L50 63L36 46V75H22Z"
        fill="url(#mdm-logo-grad)"
      />
      <circle cx="50" cy="72" r="4" fill="#38BDF8" />
      <defs>
        <linearGradient id="mdm-bg-grad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
          <stop stopColor="#0F172A" />
          <stop offset="1" stopColor="#1E1B4B" />
        </linearGradient>
        <linearGradient id="mdm-logo-grad" x1="22" y1="25" x2="78" y2="75" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366F1" />
          <stop offset="0.5" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#06B6D4" />
        </linearGradient>
      </defs>
    </svg>
  );
}

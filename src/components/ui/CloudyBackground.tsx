"use client";
import { cn } from "@/lib/utils";
import React from "react";

interface CloudyBackgroundProps {
  className?: string;
}

export const CloudyBackground: React.FC<CloudyBackgroundProps> = ({
  className,
}) => {
  return (
    <div
      className={cn(
        "absolute inset-0 w-full h-full pointer-events-none",
        className
      )}
    >
      {/* Purple at top right */}
      <div className="absolute top-0 right-0 w-1/4 h-1/4 bg-gradient-to-bl from-purple-900/15 to-transparent blur-2xl" />
      
      {/* Blue at bottom left */}
      <div className="absolute bottom-0 left-0 w-1/4 h-1/4 bg-gradient-to-tr from-blue-900/15 to-transparent blur-2xl" />
    </div>
  );
};
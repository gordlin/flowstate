import * as React from "react";
import { cn } from "@/lib/utils";
import { Download } from "lucide-react";

interface DownloadButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
}

const DownloadButton = React.forwardRef<HTMLButtonElement, DownloadButtonProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "group relative inline-flex items-center justify-center gap-3",
          "px-10 py-5 text-lg font-semibold",
          "bg-primary text-primary-foreground",
          "rounded-2xl",
          "transition-all duration-300 ease-out",
          "hover:scale-105 active:scale-100",
          "glow-primary hover:glow-primary-intense",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          className
        )}
        {...props}
      >
        <Download className="w-5 h-5 transition-transform duration-300 group-hover:-translate-y-0.5" />
        <span className="relative">
          {children}
          <span className="absolute inset-x-0 -bottom-px h-px bg-gradient-to-r from-transparent via-primary-foreground/50 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
        </span>
      </button>
    );
  }
);

DownloadButton.displayName = "DownloadButton";

export { DownloadButton };

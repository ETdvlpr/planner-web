"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { ImagePlus } from "lucide-react";
import { filesFromClipboard, filesFromDrop } from "@/lib/upload";
import { cn } from "@/lib/utils";

/**
 * Turns a region into a paste-and-drop target for files.
 *
 * Paste is listened for on the document, not the element: the whole point is
 * that a person can Cmd+Shift+4 a screenshot and Cmd+V it without first
 * clicking somewhere specific. Text pastes into inputs are left alone —
 * only clipboard items that are files are taken.
 */
export function DropZone({
  onFiles,
  disabled = false,
  listenForPaste = true,
  className,
  children,
  hint = "Drop files or paste a screenshot",
}: {
  onFiles: (files: File[]) => void;
  disabled?: boolean;
  listenForPaste?: boolean;
  className?: string;
  children: ReactNode;
  hint?: ReactNode;
}) {
  const [dragging, setDragging] = useState(false);
  const depth = useRef(0);

  useEffect(() => {
    if (!listenForPaste || disabled) return;
    const onPaste = (event: ClipboardEvent) => {
      const files = filesFromClipboard(event.clipboardData);
      if (files.length === 0) return;
      event.preventDefault();
      onFiles(files);
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [onFiles, listenForPaste, disabled]);

  const onDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    depth.current += 1;
    setDragging(true);
  }, []);
  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    depth.current -= 1;
    if (depth.current <= 0) {
      depth.current = 0;
      setDragging(false);
    }
  }, []);
  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      depth.current = 0;
      setDragging(false);
      if (disabled) return;
      const files = filesFromDrop(e.dataTransfer);
      if (files.length) onFiles(files);
    },
    [onFiles, disabled],
  );

  return (
    <div
      onDragEnter={onDragEnter}
      onDragOver={(e) => e.preventDefault()}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn("relative", className)}
    >
      {children}
      {dragging && !disabled && (
        <div className="border-accent bg-accent-soft/80 text-accent pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-xl border-2 border-dashed">
          <div className="flex items-center gap-2 font-medium">
            <ImagePlus className="h-5 w-5" />
            {hint}
          </div>
        </div>
      )}
    </div>
  );
}

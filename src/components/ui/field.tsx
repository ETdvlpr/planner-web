"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/utils";

/**
 * Form controls. Native elements with consistent chrome — `<select>` stays
 * native on purpose: it works with the keyboard, the screen reader and the
 * OS picker for free, and this app has far more forms than brand moments.
 */

const control =
  "w-full rounded-lg border border-border bg-surface px-3 text-sm text-fg " +
  "placeholder:text-fg-faint transition-colors hover:border-border-strong " +
  "focus:border-accent focus:outline-none focus:ring-2 focus:ring-(--ring) " +
  "disabled:opacity-60";

export const Input = forwardRef<
  HTMLInputElement,
  InputHTMLAttributes<HTMLInputElement>
>(function Input({ className, ...rest }, ref) {
  return (
    <input ref={ref} className={cn(control, "h-9", className)} {...rest} />
  );
});

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...rest }, ref) {
  return (
    <textarea
      ref={ref}
      className={cn(control, "min-h-20 py-2 leading-relaxed", className)}
      {...rest}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, children, ...rest }, ref) {
  return (
    <select
      ref={ref}
      className={cn(control, "h-9 cursor-pointer pr-8", className)}
      {...rest}
    >
      {children}
    </select>
  );
});

export function Field({
  label,
  hint,
  error,
  children,
  className,
  htmlFor,
}: {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-fg-muted text-[12px] font-medium tracking-wide uppercase"
        >
          {label}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-danger text-xs">{error}</p>
      ) : hint ? (
        <p className="text-fg-faint text-xs">{hint}</p>
      ) : null}
    </div>
  );
}

export function Checkbox({
  className,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type="checkbox"
      className={cn(
        "border-border-strong h-4 w-4 shrink-0 cursor-pointer rounded accent-(--accent)",
        className,
      )}
      {...rest}
    />
  );
}

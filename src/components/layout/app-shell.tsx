"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  CalendarClock,
  CheckSquare,
  ClipboardList,
  FolderKanban,
  Gavel,
  Inbox,
  LogOut,
  Menu,
  NotebookPen,
  Settings,
  Sparkles,
  StickyNote,
  Users,
  X,
} from "lucide-react";
import { useAuth } from "@/auth/auth-provider";
import { useHotkey, useMe } from "@/lib/hooks";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: typeof Inbox;
  /** Single-key shortcut when nothing is focused. */
  key?: string;
}

const NAV: { heading?: string; items: NavItem[] }[] = [
  {
    items: [
      { href: "/", label: "Capture", icon: Sparkles, key: "c" },
      { href: "/inbox", label: "Inbox", icon: Inbox, key: "i" },
      { href: "/tasks", label: "Tasks", icon: CheckSquare, key: "t" },
    ],
  },
  {
    heading: "Work",
    items: [
      {
        href: "/organizations",
        label: "Organizations",
        icon: Building2,
        key: "o",
      },
      { href: "/projects", label: "Projects", icon: FolderKanban, key: "p" },
      { href: "/meetings", label: "Meetings", icon: Users, key: "m" },
      { href: "/requirements", label: "Requirements", icon: ClipboardList },
      { href: "/decisions", label: "Decisions", icon: Gavel },
      { href: "/notes", label: "Notes", icon: StickyNote, key: "n" },
    ],
  },
  {
    heading: "Reflect",
    items: [
      { href: "/activity", label: "Activity", icon: NotebookPen },
      {
        href: "/review",
        label: "Weekly review",
        icon: CalendarClock,
        key: "r",
      },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  // The account row is created server-side on the first `/users/me`; do it
  // as soon as the shell mounts rather than on the first data page.
  useMe();

  // g then <key> is the classic; a bare key is faster and the app has no
  // single-key actions elsewhere that would collide.
  useHotkey("c", () => router.push("/"));
  useHotkey("i", () => router.push("/inbox"));
  useHotkey("t", () => router.push("/tasks"));
  useHotkey("o", () => router.push("/organizations"));
  useHotkey("p", () => router.push("/projects"));
  useHotkey("m", () => router.push("/meetings"));
  useHotkey("n", () => router.push("/notes"));
  useHotkey("r", () => router.push("/review"));

  return (
    <div className="flex min-h-screen">
      {/* Mobile top bar */}
      <header className="border-border bg-surface fixed inset-x-0 top-0 z-30 flex h-12 items-center gap-2 border-b px-3 lg:hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          className="hover:bg-surface-2 rounded-md p-1.5"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
        <span className="font-semibold">Planner</span>
      </header>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        className={cn(
          "border-border bg-surface fixed inset-y-0 left-0 z-40 flex w-60 flex-col border-r transition-transform lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center gap-2.5 px-4">
          <div className="bg-accent text-accent-fg flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold">
            P
          </div>
          <span className="font-semibold tracking-tight">Planner</span>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-4">
          {NAV.map((group, i) => (
            <div key={i} className="mb-3">
              {group.heading && (
                <p className="text-fg-faint px-2 pt-2 pb-1 text-[11px] font-medium tracking-wider uppercase">
                  {group.heading}
                </p>
              )}
              {group.items.map((item) => {
                const active =
                  item.href === "/"
                    ? pathname === "/"
                    : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "group flex h-8 items-center gap-2.5 rounded-md px-2 text-[13px] font-medium transition-colors",
                      active
                        ? "bg-accent-soft text-accent"
                        : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span className="flex-1">{item.label}</span>
                    {item.key && (
                      <kbd className="opacity-0 transition-opacity group-hover:opacity-100">
                        {item.key}
                      </kbd>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <UserMenu />
      </aside>

      <main className="min-w-0 flex-1 pt-12 lg:pt-0 lg:pl-60">
        <div className="mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </div>
      </main>
    </div>
  );
}

function UserMenu() {
  const { user, signOut } = useAuth();
  const initial = (user?.displayName ?? user?.email ?? "?")[0]?.toUpperCase();
  return (
    <div className="border-border flex items-center gap-2 border-t p-2">
      <Link
        href="/settings"
        className="hover:bg-surface-2 flex min-w-0 flex-1 items-center gap-2.5 rounded-md px-2 py-1.5"
      >
        {user?.photoURL ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.photoURL}
            alt=""
            className="h-7 w-7 rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="bg-surface-2 flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold">
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">
            {user?.displayName ?? "Account"}
          </p>
          <p className="text-fg-faint truncate text-[11px]">{user?.email}</p>
        </div>
        <Settings className="text-fg-faint h-4 w-4" />
      </Link>
      <button
        onClick={() => void signOut()}
        className="text-fg-faint hover:bg-surface-2 hover:text-fg rounded-md p-2"
        aria-label="Sign out"
        title="Sign out"
      >
        <LogOut className="h-4 w-4" />
      </button>
    </div>
  );
}

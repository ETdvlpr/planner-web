"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import * as api from "@/lib/api";
import { errorMessage } from "@/lib/api";
import { keys } from "@/lib/query";
import type { Organization, Project, UUID } from "@/lib/api";

/** The signed-in Planner user. First call creates the account server-side. */
export function useMe() {
  return useQuery({
    queryKey: keys.me,
    queryFn: api.users.me,
    staleTime: 5 * 60_000,
  });
}

/**
 * Every organization and project, loaded once and shared. Pickers, name
 * lookups and breadcrumbs all read from here, so they never disagree, and
 * nothing paginates: a person with a hundred organizations has a different
 * product.
 */
export function useOrganizations() {
  return useQuery({
    queryKey: keys.organizations.list("all"),
    queryFn: () => api.organizations.list({ pageSize: 100 }),
    select: (page) => page.items,
    staleTime: 5 * 60_000,
  });
}

export function useProjects() {
  return useQuery({
    queryKey: keys.projects.list("all"),
    queryFn: () => api.projects.list({ pageSize: 100 }),
    select: (page) => page.items,
    staleTime: 5 * 60_000,
  });
}

export interface Lookup {
  organizations: Organization[];
  projects: Project[];
  organization: (id: UUID | null | undefined) => Organization | undefined;
  project: (id: UUID | null | undefined) => Project | undefined;
  /** Projects of one organization, or the unassigned ones for `null`. */
  projectsOf: (organizationId: UUID | null | undefined) => Project[];
  loading: boolean;
}

export function useLookup(): Lookup {
  const orgs = useOrganizations();
  const projects = useProjects();

  return useMemo(() => {
    const orgList = orgs.data ?? [];
    const projectList = projects.data ?? [];
    const orgById = new Map(orgList.map((o) => [o.id, o]));
    const projectById = new Map(projectList.map((p) => [p.id, p]));
    return {
      organizations: orgList,
      projects: projectList,
      organization: (id) => (id ? orgById.get(id) : undefined),
      project: (id) => (id ? projectById.get(id) : undefined),
      projectsOf: (organizationId) =>
        projectList.filter((p) =>
          organizationId
            ? p.organizationId === organizationId
            : !p.organizationId,
        ),
      loading: orgs.isLoading || projects.isLoading,
    };
  }, [orgs.data, projects.data, orgs.isLoading, projects.isLoading]);
}

/**
 * A mutation that toasts on failure and invalidates the given keys on
 * success — which is every mutation in this app. `onSuccess` still runs for
 * the caller's own follow-up (close a dialog, navigate).
 */
export function useApiMutation<TInput, TOutput>(
  fn: (input: TInput) => Promise<TOutput>,
  options: {
    invalidate?: readonly (readonly unknown[])[];
    onSuccess?: (result: TOutput, input: TInput) => void;
    successMessage?: string | ((result: TOutput) => string);
  } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (result, input) => {
      for (const key of options.invalidate ?? []) {
        void queryClient.invalidateQueries({ queryKey: key });
      }
      if (options.successMessage) {
        toast.success(
          typeof options.successMessage === "function"
            ? options.successMessage(result)
            : options.successMessage,
        );
      }
      options.onSuccess?.(result, input);
    },
    onError: (error) => toast.error(errorMessage(error)),
  });
}

/** Debounced value — for search boxes and autosave. */
export function useDebounced<T>(value: T, delay = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

/**
 * Autosaves a text field. Local edits render immediately; the save fires
 * after a pause in typing. Server changes are adopted only while the field
 * is clean, so a background refetch never overwrites what is being typed.
 *
 * "Saving…" covers the debounce window too — the value is not on the server
 * yet either way, and a status that flickers between two words is noise.
 */
export function useAutosave(
  serverValue: string,
  save: (value: string) => Promise<unknown>,
  delay = 800,
) {
  const [state, setState] = useState({
    value: serverValue,
    lastSaved: serverValue,
    seenServer: serverValue,
    error: false,
  });

  // Adopting a new server value is derived during render (the "previous
  // props in state" pattern), not in an effect.
  if (serverValue !== state.seenServer) {
    const dirty = state.value !== state.lastSaved;
    setState(
      dirty
        ? { ...state, seenServer: serverValue }
        : {
            value: serverValue,
            lastSaved: serverValue,
            seenServer: serverValue,
            error: false,
          },
    );
  }

  const debounced = useDebounced(state.value, delay);

  useEffect(() => {
    if (debounced === state.lastSaved) return;
    let cancelled = false;
    save(debounced)
      .then(() => {
        if (cancelled) return;
        setState((s) => ({ ...s, lastSaved: debounced, error: false }));
      })
      .catch((error) => {
        if (cancelled) return;
        setState((s) => ({ ...s, error: true }));
        toast.error(errorMessage(error));
      });
    return () => {
      cancelled = true;
    };
    // `save` is expected to be stable (a useCallback over the id).
  }, [debounced, save, state.lastSaved]);

  const onChange = useCallback(
    (next: string) => setState((s) => ({ ...s, value: next })),
    [],
  );

  const dirty = state.value !== state.lastSaved;
  const status: "saved" | "saving" | "error" = state.error
    ? "error"
    : dirty
      ? "saving"
      : "saved";

  return { value: state.value, onChange, status, dirty };
}

/** Keyboard shortcut, ignoring keystrokes inside editable elements. */
export function useHotkey(
  key: string,
  handler: (event: KeyboardEvent) => void,
  { meta = false, allowInInputs = false } = {},
) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== key.toLowerCase()) return;
      if (meta !== (event.metaKey || event.ctrlKey)) return;
      if (!allowInInputs) {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName;
        if (
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target?.isContentEditable
        ) {
          return;
        }
      }
      event.preventDefault();
      handler(event);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [key, handler, meta, allowInInputs]);
}

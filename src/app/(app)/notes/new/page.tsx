import { Suspense } from "react";
import { NewNotePage } from "@/features/notes/new-note-page";

export const metadata = { title: "New note" };

export default function Page() {
  return (
    <Suspense>
      <NewNotePage />
    </Suspense>
  );
}

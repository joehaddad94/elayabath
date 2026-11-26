import { PageSkeleton } from "../PageSkeleton";

/**
 * Moving between pages inside this section (a list to one of its items, or
 * one site page to another) re-renders only below the section, where the
 * dashboard-wide loading screen doesn't reach. Without this, the old screen
 * sat frozen until the new one had fully arrived.
 */
export default function Loading() {
  return <PageSkeleton />;
}

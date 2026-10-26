// Authenticated application layout. Middleware already blocks anonymous visitors; this re-checks
// on the server and passes only safe, public configuration to the browser.
import { redirect } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AppStateProvider } from "@/features/app-state/AppStateProvider";
import { getViewer } from "@/lib/auth/session";
import { getPublicConfig } from "@/lib/config";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const viewer = await getViewer();
  if (!viewer) redirect("/login");
  const config = getPublicConfig();
  return (
    <AppStateProvider config={config}>
      <AppShell userLabel={viewer.kind === "demo" ? "Demo student" : (viewer.email ?? "Student")}>{children}</AppShell>
    </AppStateProvider>
  );
}

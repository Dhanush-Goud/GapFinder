import type { Metadata } from "next";
import { SettingsView } from "@/features/settings/SettingsView";
import { getViewer } from "@/lib/auth/session";
export const metadata: Metadata = { title: "Settings" };
export default async function Page() {
  const viewer = await getViewer();
  return <SettingsView userLabel={viewer?.kind === "user" ? (viewer.email ?? "Student") : "Demo student"} />;
}

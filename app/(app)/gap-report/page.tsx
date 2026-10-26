import type { Metadata } from "next";
import { GapReportView } from "@/features/gap-report/GapReportView";
export const metadata: Metadata = { title: "Gap report" };
export default function Page() { return <GapReportView />; }

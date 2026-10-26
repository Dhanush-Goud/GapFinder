import type { Metadata } from "next";
import { RevisionPlanView } from "@/features/revision/RevisionPlanView";
export const metadata: Metadata = { title: "Revision plan" };
export default function Page() { return <RevisionPlanView />; }

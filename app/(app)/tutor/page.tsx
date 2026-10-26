import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { TutorView } from "@/features/tutor/TutorView";
export const metadata: Metadata = { title: "Explain a topic" };
export default function Page() { return <Suspense fallback={<Spinner />}><TutorView /></Suspense>; }

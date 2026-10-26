import type { Metadata } from "next";
import { Suspense } from "react";
import { Spinner } from "@/components/ui";
import { QuizView } from "@/features/quiz/QuizView";
export const metadata: Metadata = { title: "Diagnostic quiz" };
export default function Page() { return <Suspense fallback={<Spinner />}><QuizView /></Suspense>; }

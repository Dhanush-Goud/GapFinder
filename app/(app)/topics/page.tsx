import type { Metadata } from "next";
import { TopicsView } from "@/features/topics/TopicsView";
export const metadata: Metadata = { title: "Topic map" };
export default function Page() { return <TopicsView />; }

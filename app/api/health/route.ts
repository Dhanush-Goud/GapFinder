// Reports which integrations are configured (never the values).
import { ok, route } from "@/lib/api/respond";
import { getPublicConfig } from "@/lib/config";

export const dynamic = "force-dynamic";
export const GET = route(async () => ok({ status: "ok", ...getPublicConfig() }));

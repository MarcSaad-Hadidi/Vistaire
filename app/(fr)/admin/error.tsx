"use client";
import { StudioState } from "@/components/admin/studio/StudioState";
export default function Error({ reset }: { reset: () => void }) { return <StudioState kind="error" onRetry={reset}/>; }

"use client";
import { Controls } from "@/components/Controls";
import { IframePreview } from "@/components/IframePreview";
import { RightPane } from "@/components/RightPane";
import { useAppStore } from "@/lib/store";

export default function Home() {
  return (
    <div className="min-h-screen p-6">
      <div className="text-xl font-bold mb-4">Website Inspector</div>
      <div className="grid grid-cols-[360px_1fr_420px] gap-4 items-start">
        <Controls />
        <IframePreview />
        <RightPane />
      </div>
    </div>
  );
}

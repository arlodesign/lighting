"use client";
import { ShowRunner } from "@/runtime/ShowRunner";
import { getShowByName } from "@/shows";
import Link from "next/link";
import { use } from "react";
import { useRouter } from "next/navigation";

export default function ShowSceneLookPage({
  params,
}: {
  params: Promise<{ showName: string; sceneId: string; lookId: string }>;
}) {
  const { showName, sceneId, lookId } = use(params);
  const show = getShowByName(showName);
  const router = useRouter();

  if (!show) {
    return (
      <main className="min-h-screen bg-black text-zinc-300 p-6 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-white mb-4">Show Not Found</h1>
          <p className="text-zinc-400 mb-6">
            The show &quot;{showName}&quot; could not be found.
          </p>
          <Link
            href="/"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black"
          >
            ← Back to Show Index
          </Link>
        </div>
      </main>
    );
  }

  // Validate scene & look against show; fall back to first scene/look if invalid
  const validScene =
    show.scenes.find((s) => s.id === sceneId) ?? show.scenes[0];
  const looksCount = validScene.looks.length;
  const parsedLook = Math.max(1, Math.min(4, Number(lookId) || 1)) as
    | 1
    | 2
    | 3
    | 4;
  const clampedLook = (parsedLook <= looksCount ? parsedLook : 1) as
    | 1
    | 2
    | 3
    | 4;

  const onNavigate = (newSceneId: string, newLook: 1 | 2 | 3 | 4) => {
    router.replace(`/show/${showName}/scene/${newSceneId}/look/${newLook}`);
  };

  return (
    <ShowRunner
      show={show}
      initialSceneId={validScene.id}
      initialLook={clampedLook}
      onNavigate={onNavigate}
    />
  );
}

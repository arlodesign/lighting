import { getShowByName } from "@/shows";
import Link from "next/link";
import { redirect } from "next/navigation";

export default function ShowPage({ params }: { params: { showName: string } }) {
  const { showName } = params;
  const show = getShowByName(showName);

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

  // Default deep link to first scene/look
  const firstScene = show.scenes[0];
  redirect(`/show/${showName}/scene/${firstScene.id}/look/1`);
}

"use client";

import Link from "next/link";
import { getShowMetadata } from "@/shows";
import { QlcStatus } from "@/components/QlcStatus";

export default function Home() {
  const shows = getShowMetadata();

  return (
    <main className="min-h-screen bg-black text-zinc-300 p-6">
      <div className="max-w-4xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">
            Lighting Control
          </h1>
          <p className="text-zinc-400">
            Select a show to begin lighting control and visualization
          </p>
        </header>

        <section>
          <QlcStatus variant="banner" />
          <h2 className="text-2xl font-semibold text-white mb-6">
            Available Shows
          </h2>

          {shows.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-zinc-500 text-lg">No shows available</p>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {shows.map((show) => (
                <Link
                  key={show.id}
                  href={`/show/${show.id}`}
                  className="group block p-6 bg-zinc-900 rounded-lg border border-zinc-800 hover:border-zinc-600 hover:bg-zinc-800 transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-black"
                >
                  <div className="mb-4">
                    <h3 className="text-xl font-semibold text-white group-hover:text-blue-300 transition-colors">
                      {show.name}
                    </h3>
                    <p className="text-sm text-zinc-500 mt-1">
                      {show.sceneCount} scene{show.sceneCount !== 1 ? "s" : ""}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-zinc-400">
                      Scenes:
                    </h4>
                    <ul className="space-y-1">
                      {show.scenes.map((scene, index) => (
                        <li
                          key={index}
                          className="text-sm text-zinc-500 flex justify-between"
                        >
                          <span>{scene.name}</span>
                          <span className="text-zinc-600">
                            {scene.lookCount} look
                            {scene.lookCount !== 1 ? "s" : ""}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-4 pt-4 border-t border-zinc-800">
                    <span className="text-sm text-blue-400 group-hover:text-blue-300">
                      Launch Show →
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

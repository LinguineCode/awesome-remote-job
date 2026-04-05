import Link from "next/link";

export default function HomePage() {
  return (
    <div className="min-h-[calc(100vh-64px)]">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-gray-900 via-blue-950 to-gray-900">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(59,130,246,0.15),transparent_50%)]" />
        <div className="relative mx-auto max-w-5xl px-4 py-24 sm:py-32 text-center">
          <h1 className="text-4xl sm:text-6xl font-extrabold text-white tracking-tight">
            Find the exact car
            <br />
            <span className="bg-gradient-to-r from-blue-400 to-cyan-300 bg-clip-text text-transparent">
              you&apos;re looking for
            </span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-300 max-w-2xl mx-auto leading-relaxed">
            CarFinder uses AI to search across Craigslist, AutoTempest, and more
            — filtering out junk, validating listings, and delivering only the
            cars that match your exact criteria. Daily.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 hover:shadow-blue-600/40 transition-all"
            >
              Start Finding Cars
            </Link>
          </div>
          <p className="mt-4 text-sm text-gray-400">
            Free to use. No credit card required.
          </p>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-5xl px-4 py-20">
        <h2 className="text-center text-3xl font-bold text-gray-900">
          How it works
        </h2>
        <p className="mt-3 text-center text-gray-600 max-w-xl mx-auto">
          Set up your search once. We do the rest, every day.
        </p>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl font-bold text-blue-700">
              1
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              Describe your car
            </h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              Set make, model, year, price, and — crucially — write freeform
              notes. &quot;Must be a 997.1, no sunroof, prefer sport chrono.&quot;
              Our AI understands all of it.
            </p>
          </div>

          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl font-bold text-blue-700">
              2
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              We search everywhere
            </h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              Every day, we scrape Craigslist, AutoTempest, and other sources.
              Then AI reads every listing, extracts real data from messy posts,
              and scores each one.
            </p>
          </div>

          <div className="text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-100 text-2xl font-bold text-blue-700">
              3
            </div>
            <h3 className="mt-4 text-lg font-semibold text-gray-900">
              Get your daily digest
            </h3>
            <p className="mt-2 text-sm text-gray-600 leading-relaxed">
              One clean email per day with only high-confidence matches.
              AI-written summaries, scam flags, below-market-price alerts.
              Click through to the listing.
            </p>
          </div>
        </div>
      </section>

      {/* AI Notes feature highlight */}
      <section className="bg-white border-y border-gray-200">
        <div className="mx-auto max-w-5xl px-4 py-20">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
                The magic
              </span>
              <h2 className="mt-2 text-3xl font-bold text-gray-900">
                AI that reads like you do
              </h2>
              <p className="mt-4 text-gray-600 leading-relaxed">
                Normal car search filters can&apos;t tell a 997.1 from a 997.2.
                They can&apos;t check if a listing mentions sport chrono in the
                description. They can&apos;t spot a scammy &quot;MUST SELL
                TODAY&quot; post.
              </p>
              <p className="mt-4 text-gray-600 leading-relaxed">
                CarFinder&apos;s AI reads every listing like an enthusiast would.
                Write your notes in plain English — the more specific, the
                better the results.
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 border border-gray-200 p-6">
              <p className="text-xs font-semibold text-gray-500 uppercase mb-3">
                Example AI Notes
              </p>
              <div className="space-y-4 text-sm text-gray-700">
                <div className="rounded-lg bg-white border border-gray-200 p-4">
                  <p className="font-medium text-gray-900 mb-1">
                    Porsche 911 Search
                  </p>
                  <p className="italic text-gray-600">
                    &quot;Must be a 997.1 (2005-2008). No Carrera 4 or 4S. Prefer
                    Seal Grey or Arctic Silver. Must have sport chrono package.
                    Manual gearbox only.&quot;
                  </p>
                </div>
                <div className="rounded-lg bg-white border border-gray-200 p-4">
                  <p className="font-medium text-gray-900 mb-1">
                    Budget Miata Search
                  </p>
                  <p className="italic text-gray-600">
                    &quot;NA or NB generation. Must be a hardtop or have a
                    hardtop included. No rust — I&apos;m in the northeast so
                    this is critical. Prefer a clean, stock example.&quot;
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-4 py-20 text-center">
        <h2 className="text-3xl font-bold text-gray-900">
          Stop scrolling. Start finding.
        </h2>
        <p className="mt-3 text-gray-600 max-w-lg mx-auto">
          Set up your search in 2 minutes. Get your first results tomorrow
          morning.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-block rounded-xl bg-blue-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-blue-600/25 hover:bg-blue-700 transition-all"
        >
          Get Started — Free
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white">
        <div className="mx-auto max-w-5xl px-4 py-8 flex items-center justify-between text-sm text-gray-500">
          <span>CarFinder</span>
          <span>Built with precision.</span>
        </div>
      </footer>
    </div>
  );
}

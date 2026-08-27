import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';

export const AboutPage = () => {
  return (
    <div className="min-h-screen bg-cream text-ink dark:bg-[#101820] dark:text-white flex flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-12 space-y-12 flex-1">
        {/* Intro */}
        <section className="text-center space-y-4">
          <div className="inline-flex items-center gap-2 rounded-full bg-coral/10 px-4 py-1.5 text-xs font-bold text-coral dark:bg-coral/20">
            <span>✦</span>
            <span>About MAXSHOW</span>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black text-ink dark:text-white tracking-tight">
            Connecting people with <span className="text-coral">good plans.</span>
          </h1>
          <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto leading-relaxed">
            MAXSHOW is Pune and PCMC’s dedicated discovery platform for intimate live music, secret comedy rooms, hands-on workshops, and community gatherings.
          </p>
        </section>

        {/* Pillars Grid */}
        <section className="grid gap-6 sm:grid-cols-3">
          <div className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm dark:border-slate-700/80 dark:bg-[#1c2733] space-y-3">
            <span className="text-3xl">🎸</span>
            <h3 className="text-lg font-black text-ink dark:text-white">Curated Spaces</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              We focus on smaller, community-led rooms where you can truly connect with performers and other attendees.
            </p>
          </div>

          <div className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm dark:border-slate-700/80 dark:bg-[#1c2733] space-y-3">
            <span className="text-3xl">🎟️</span>
            <h3 className="text-lg font-black text-ink dark:text-white">Seamless Passes</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Instant QR passes delivered directly to your device with zero ticketing friction or hidden convenience charges.
            </p>
          </div>

          <div className="rounded-3xl border border-stone-200/80 bg-white p-6 shadow-sm dark:border-slate-700/80 dark:bg-[#1c2733] space-y-3">
            <span className="text-3xl">🤝</span>
            <h3 className="text-lg font-black text-ink dark:text-white">For Organisers</h3>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 leading-relaxed">
              Empowering independent hosts and artists with direct booking infrastructure, real-time analytics, and community reach.
            </p>
          </div>
        </section>

        {/* CTA */}
        <section className="rounded-[2.5rem] bg-stone-900 p-8 sm:p-12 text-center text-white space-y-4">
          <h2 className="text-2xl sm:text-3xl font-black">Host your next gathering with us</h2>
          <p className="text-xs sm:text-sm text-slate-400 max-w-md mx-auto">
            Are you a musician, comic, chef, or workshop host? Join our organiser portal and start listing your experiences today.
          </p>
          <div className="pt-2">
            <Link
              to="/admin"
              className="inline-block rounded-2xl bg-coral px-6 py-3 text-sm font-bold text-white shadow-md hover:bg-[#df503c] transition"
            >
              Go to Organiser Portal →
            </Link>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
};

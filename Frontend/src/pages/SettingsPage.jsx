import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { useAuth } from '../context/AuthContext';

export const SettingsPage = () => {
  const { user, isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-cream text-ink dark:bg-[#101820] dark:text-white flex flex-col">
      <Navbar />

      <main className="mx-auto w-full max-w-4xl px-4 sm:px-6 lg:px-8 py-8 space-y-8 flex-1">
        <div>
          <h1 className="text-3xl font-black text-ink dark:text-white">Account Settings</h1>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            Manage your personal details, preferences, and security.
          </p>
        </div>

        {isAuthenticated ? (
          <div className="space-y-6">
            <div className="rounded-[2.5rem] border border-stone-200/80 bg-white p-6 sm:p-8 dark:border-slate-700/80 dark:bg-[#1c2733] shadow-sm space-y-4">
              <h2 className="text-xl font-black text-ink dark:text-white">Profile Overview</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Full Name</p>
                  <p className="font-bold text-ink dark:text-white mt-1">{user?.name}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Username</p>
                  <p className="font-bold text-coral mt-1">@{user?.username}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Email Address</p>
                  <p className="font-bold text-ink dark:text-white mt-1">{user?.email}</p>
                </div>
                <div>
                  <p className="text-slate-400 font-bold uppercase text-[10px]">Mobile Number</p>
                  <p className="font-bold text-ink dark:text-white mt-1">{user?.phone || 'Not provided'}</p>
                </div>
              </div>
              <div className="pt-2">
                <Link
                  to="/dashboard"
                  className="inline-block rounded-2xl bg-coral px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-[#df503c] transition"
                >
                  Edit Profile in Dashboard →
                </Link>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-[2.5rem] bg-white p-12 text-center shadow-soft dark:bg-[#1c2733] border border-stone-200/80 dark:border-slate-700">
            <span className="text-4xl">🔒</span>
            <h3 className="mt-3 text-lg font-black text-ink dark:text-white">Sign in to view settings</h3>
            <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
              You need to be signed in to manage your account settings.
            </p>
            <Link
              to="/user"
              className="mt-4 inline-block rounded-2xl bg-coral px-6 py-3 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[#df503c] transition"
            >
              Sign In →
            </Link>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import type { Profile } from "@/types";

export function Nav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.me()
      .then((data) => setUser(data.user as Profile | null))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await api.logout();
    setUser(null);
    router.push("/");
  };

  const navLinks = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/searches", label: "Searches" },
    { href: "/settings", label: "Settings" },
  ];

  return (
    <nav className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-5xl px-4 sm:px-6">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href={user ? "/dashboard" : "/"} className="text-xl font-extrabold text-gray-900">
              CarFinder
            </Link>
            {user && (
              <div className="hidden sm:flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      pathname.startsWith(link.href)
                        ? "bg-blue-50 text-blue-700"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {loading ? (
              <div className="h-8 w-20 animate-pulse rounded bg-gray-100" />
            ) : user ? (
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-600 hidden sm:block">{user.email}</span>
                <button
                  onClick={handleLogout}
                  className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-colors"
                >
                  Log out
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 transition-colors"
              >
                Get Started
              </Link>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}

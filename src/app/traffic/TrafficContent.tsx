"use client";

import { useEffect, useState } from "react";
import { PageContainer } from "@/components/layout";

interface PageView {
  path: string;
  count: number;
}

interface DailyTraffic {
  date: string;
  totalViews: number;
  uniqueVisitors: number;
  pages: PageView[];
}

interface GameStats {
  totalCompletions: number;
  last30Days: number;
  daily: { date: string; completions: number }[];
}

const EASTER_EGG_MESSAGES = [
  "You found the secret analytics page. You must be curious.",
  "Welcome to the backend of the backend. No data is sold here.",
  "Achievement unlocked: Data Voyeur",
  "These stats are only mildly interesting, but you're here anyway.",
  "If you're reading this, you're probably the only visitor today.",
];

export default function TrafficContent() {
  const [stats, setStats] = useState<DailyTraffic[]>([]);
  const [gameStats, setGameStats] = useState<GameStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [easterEgg] = useState(
    () => EASTER_EGG_MESSAGES[Math.floor(Math.random() * EASTER_EGG_MESSAGES.length)]
  );

  useEffect(() => {
    Promise.all([
      fetch("/api/traffic").then((r) => r.json()),
      fetch("/api/leaderboard/stats").then((r) => r.json()),
    ])
      .then(([trafficData, gameData]) => {
        setStats(trafficData.stats || []);
        setGameStats(gameData);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const activeDays = stats.filter((d) => d.totalViews > 0);
  const totalViews = stats.reduce((s, d) => s + d.totalViews, 0);
  const totalUnique = stats.reduce((s, d) => s + d.uniqueVisitors, 0);
  const todayStats = stats[0];

  return (
    <PageContainer title="Traffic" description="Page view analytics.">
      {/* Easter egg */}
      <div className="mb-6 rounded-md border border-accent/20 bg-accent/5 px-4 py-3">
        <p className="text-xs text-accent font-mono italic">{easterEgg}</p>
      </div>

      {loading ? (
        <p className="text-muted text-sm">Loading stats...</p>
      ) : (
        <div className="space-y-8">
          {/* Summary cards */}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Today" value={todayStats?.totalViews ?? 0} sub="views" />
            <StatCard label="30 Days" value={totalViews} sub="total views" />
            <StatCard label="Unique" value={totalUnique} sub="visitors (30d)" />
            <StatCard
              label="Games Completed"
              value={gameStats?.totalCompletions ?? 0}
              sub="all time"
              accent
            />
          </div>

          {/* Game completions graph */}
          {gameStats && gameStats.daily.some((d) => d.completions > 0) && (
            <div>
              <h2 className="text-sm font-medium text-muted mb-3">
                Daily Game Completions (30 days)
              </h2>
              <CompletionGraph data={gameStats.daily} />
            </div>
          )}

          {/* Daily breakdown — only days with traffic */}
          {activeDays.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted mb-3">
                Daily Views
                <span className="ml-2 text-xs text-muted/70 font-normal">
                  ({activeDays.length} active day{activeDays.length !== 1 ? "s" : ""})
                </span>
              </h2>
              <div className="space-y-1">
                {activeDays.map((day) => (
                  <div
                    key={day.date}
                    className="flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <span className="font-mono text-xs text-muted w-24">
                      {day.date}
                    </span>
                    <div className="flex-1">
                      <div
                        className="h-2 rounded-full bg-accent/60"
                        style={{
                          width: `${Math.min(100, (day.totalViews / Math.max(1, ...activeDays.map((s) => s.totalViews))) * 100)}%`,
                          minWidth: "4px",
                        }}
                      />
                    </div>
                    <span className="font-mono text-xs text-foreground w-12 text-right">
                      {day.totalViews}
                    </span>
                    <span className="text-xs text-muted w-16 text-right">
                      {day.uniqueVisitors} uniq
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeDays.length === 0 && (
            <p className="text-sm text-muted text-center py-6">
              No traffic recorded yet. You&apos;re the first visitor.
            </p>
          )}

          {/* Top pages today */}
          {todayStats && todayStats.pages.length > 0 && (
            <div>
              <h2 className="text-sm font-medium text-muted mb-3">
                Top Pages Today
              </h2>
              <div className="space-y-1">
                {todayStats.pages.slice(0, 10).map((page) => (
                  <div
                    key={page.path}
                    className="flex items-center justify-between rounded-md border border-border bg-card px-3 py-2"
                  >
                    <span className="font-mono text-xs text-foreground">
                      {page.path}
                    </span>
                    <span className="font-mono text-xs text-accent">
                      {page.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </PageContainer>
  );
}

function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number;
  sub: string;
  accent?: boolean;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <p className="text-xs text-muted">{label}</p>
      <p className={`text-2xl font-bold mt-1 ${accent ? "text-accent" : "text-foreground"}`}>
        {value}
      </p>
      <p className="text-xs text-muted mt-0.5">{sub}</p>
    </div>
  );
}

function CompletionGraph({ data }: { data: { date: string; completions: number }[] }) {
  const reversed = [...data].reverse();
  const maxVal = Math.max(1, ...reversed.map((d) => d.completions));

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-end gap-[2px] h-24">
        {reversed.map((day) => {
          const height = day.completions > 0
            ? Math.max(4, (day.completions / maxVal) * 100)
            : 0;
          return (
            <div
              key={day.date}
              className="flex-1 group relative"
              title={`${day.date}: ${day.completions}`}
            >
              <div
                className="w-full rounded-t-sm bg-accent/60 group-hover:bg-accent transition-colors"
                style={{ height: `${height}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-2">
        <span className="text-[10px] text-muted font-mono">
          {reversed[0]?.date}
        </span>
        <span className="text-[10px] text-muted font-mono">
          {reversed[reversed.length - 1]?.date}
        </span>
      </div>
      <p className="text-center text-xs text-muted mt-2">
        {data.reduce((s, d) => s + d.completions, 0)} completions in 30 days
      </p>
    </div>
  );
}

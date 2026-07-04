import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import Svg, { Polygon, Polyline } from "react-native-svg";
import { getReadingStats } from "@/api/history";
import type { StatsPeriod } from "@/api/types";
import { useThemeColors } from "@/theme/colors";

type Unit = "monthly" | "yearly";

// "2025-03" や "2025" を表示用ラベルに整形する（frontend/src/components/ReadingStats.jsx の移植）
function periodLabel(period: string, unit: Unit): string {
  if (unit === "yearly") return `${period}年`;
  const [y, m] = period.split("-");
  return `${y}/${Number(m)}`;
}

// 欠けている期間を 0 件で埋めて推移を連続させる
function fillGaps(data: StatsPeriod[], unit: Unit): StatsPeriod[] {
  if (data.length === 0) return [];
  const counts = new Map(data.map((d) => [d.period, d.count]));
  const out: StatsPeriod[] = [];
  if (unit === "yearly") {
    const start = Number(data[0].period);
    const end = Number(data[data.length - 1].period);
    for (let y = start; y <= end; y += 1) {
      const p = String(y);
      out.push({ period: p, count: counts.get(p) ?? 0 });
    }
  } else {
    let [y, m] = data[0].period.split("-").map(Number);
    const [ey, em] = data[data.length - 1].period.split("-").map(Number);
    while (y < ey || (y === ey && m <= em)) {
      const p = `${y}-${String(m).padStart(2, "0")}`;
      out.push({ period: p, count: counts.get(p) ?? 0 });
      m += 1;
      if (m > 12) {
        m = 1;
        y += 1;
      }
    }
  }
  return out;
}

interface CumulativePoint extends StatsPeriod {
  cumulative: number;
}

// 期間ごとの巻数を横棒で表示
function PeriodBars({ data, unit }: { data: CumulativePoint[]; unit: Unit }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <ScrollView className="max-h-56" nestedScrollEnabled>
      <View className="gap-1 pr-1">
        {data.map((d) => (
          <View key={d.period} className="flex-row items-center gap-2">
            <Text className="w-14 shrink-0 text-right text-xs text-ink-muted">
              {periodLabel(d.period, unit)}
            </Text>
            <View className="h-4 flex-1 rounded bg-inset">
              <View
                className="h-full rounded bg-brand"
                style={{ width: `${(d.count / max) * 100}%` }}
              />
            </View>
            <Text className="w-7 shrink-0 text-right text-xs font-semibold text-ink-muted">
              {d.count}
            </Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

// 累計の推移を SVG の面グラフで表示
function CumulativeChart({ data }: { data: CumulativePoint[] }) {
  const colors = useThemeColors();
  const { width } = useWindowDimensions();
  const W = 320;
  const H = 90;
  const pad = 6;
  const max = Math.max(1, ...data.map((d) => d.cumulative));
  const n = data.length;
  const x = (i: number) => (n <= 1 ? W / 2 : pad + (i / (n - 1)) * (W - 2 * pad));
  const y = (v: number) => H - pad - (v / max) * (H - 2 * pad);
  const line = data.map((d, i) => `${x(i)},${y(d.cumulative)}`).join(" ");
  const area = `${x(0)},${H - pad} ${line} ${x(n - 1)},${H - pad}`;
  const chartWidth = Math.min(width - 48, 480);
  return (
    <Svg
      viewBox={`0 0 ${W} ${H}`}
      width={chartWidth}
      height={(chartWidth / W) * H}
    >
      <Polygon points={area} fill={colors.brandSoft} />
      <Polyline points={line} fill="none" stroke={colors.brand} strokeWidth={2} />
    </Svg>
  );
}

/**
 * 履歴画面に埋め込む読書統計セクション（frontend/src/components/ReadingStats.jsx の移植）。
 * 履歴の追加・削除は queryKey ["history","stats"] の invalidate で再取得される。
 */
export default function ReadingStatsChart() {
  const [unit, setUnit] = useState<Unit>("monthly");
  const [open, setOpen] = useState(true);

  const { data: stats } = useQuery({
    queryKey: ["history", "stats"],
    queryFn: getReadingStats,
  });

  // 欠損補完＋累計を計算（unit 切替・データ変更で再計算）
  const series = useMemo<CumulativePoint[]>(() => {
    if (!stats) return [];
    const filled = fillGaps(stats[unit] ?? [], unit);
    let running = 0;
    return filled.map((d) => {
      running += d.count;
      return { ...d, cumulative: running };
    });
  }, [stats, unit]);

  if (!stats) return null;

  return (
    <View className="rounded-lg bg-card p-3 shadow-sm">
      <Pressable
        onPress={() => setOpen((v) => !v)}
        className="flex-row items-center justify-between"
      >
        <Text className="text-sm font-bold text-ink">📊 読書統計</Text>
        <Text className="text-xs text-ink-faint">
          {open ? "閉じる ▲" : "開く ▼"}
        </Text>
      </Pressable>

      {open && (
        <View className="mt-3 gap-4">
          {stats.total === 0 ? (
            <Text className="text-xs text-ink-faint">
              読破記録が増えると、ここに統計が表示されます。
            </Text>
          ) : (
            <>
              <View className="flex-row items-center justify-between">
                <Text className="text-sm text-ink-muted">
                  これまでに読んだ巻数{" "}
                  <Text className="text-lg font-bold text-brand-text">
                    {stats.total}
                  </Text>{" "}
                  巻
                </Text>
                <View className="flex-row gap-1">
                  {(
                    [
                      ["monthly", "月"],
                      ["yearly", "年"],
                    ] as const
                  ).map(([key, label]) => (
                    <Pressable
                      key={key}
                      onPress={() => setUnit(key)}
                      className={`rounded px-2.5 py-1 ${
                        unit === key ? "bg-brand" : "bg-inset"
                      }`}
                    >
                      <Text
                        className={`text-xs font-semibold ${
                          unit === key ? "text-white" : "text-ink-muted"
                        }`}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View>
                <Text className="mb-1 text-xs font-semibold text-ink-muted">
                  {unit === "monthly" ? "月" : "年"}ごとの読んだ巻数
                </Text>
                <PeriodBars data={series} unit={unit} />
              </View>

              <View>
                <Text className="mb-1 text-xs font-semibold text-ink-muted">
                  累計の推移
                </Text>
                <CumulativeChart data={series} />
              </View>
            </>
          )}
        </View>
      )}
    </View>
  );
}

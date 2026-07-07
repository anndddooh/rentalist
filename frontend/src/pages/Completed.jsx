import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSeries } from "../api/series.js";
import PageHeader from "../components/PageHeader.jsx";
import SeriesCover from "../components/SeriesCover.jsx";
import StarRating from "../components/StarRating.jsx";

export default function Completed() {
  const [series, setSeries] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listSeries({ status: "completed" })
      .then(setSeries)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-4 p-4 md:p-8">
      <PageHeader
        eyebrow={`読み切った ${series.length}シリーズ`}
        title="読破"
      />

      {loading ? (
        <p className="py-10 text-center text-sm text-ink-faint">読み込み中…</p>
      ) : series.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-faint">
          読破済みのシリーズはまだありません。
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-x-3.5 gap-y-4 md:grid-cols-4 lg:grid-cols-6">
          {series.map((s) => (
            <Link
              key={s.id}
              to={`/series/${s.id}`}
              className="flex flex-col gap-2"
            >
              <div className="relative">
                <SeriesCover
                  seriesId={s.id}
                  volume={1}
                  initialUrl={s.first_volume_cover_url}
                  alt={s.title}
                  className="aspect-[2/3] h-auto w-full rounded-xl shadow-card"
                />
                <span className="absolute bottom-2 left-2 rounded-full bg-ink/85 px-2.5 py-0.5 text-[11px] font-bold text-white">
                  全{s.total_volumes ?? s.current_volume}巻
                </span>
              </div>
              <div>
                <div className="font-bold leading-tight text-ink">
                  {s.title}
                </div>
                <StarRating value={s.favorite_score} size="text-xs" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

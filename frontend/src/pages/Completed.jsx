import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSeries } from "../api/series.js";
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
    <div className="space-y-3 p-3">
      <h1 className="text-lg font-bold text-slate-700">読破済み</h1>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">読み込み中…</p>
      ) : series.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          読破済みのシリーズはまだありません。
        </p>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {series.map((s) => (
            <Link
              key={s.id}
              to={`/series/${s.id}`}
              className="flex gap-3 rounded-lg bg-white p-3 shadow-sm md:flex-col md:gap-2"
            >
              <SeriesCover
                seriesId={s.id}
                volume={1}
                alt={s.title}
                className="h-28 w-20 md:h-auto md:w-full md:aspect-[2/3]"
              />
              <div className="flex flex-1 flex-col">
                <div className="font-bold leading-tight text-slate-800 md:text-lg">
                  {s.title}
                </div>
                <div className="text-xs text-slate-500">
                  全{s.total_volumes ?? s.current_volume}巻 読破
                </div>
                <div className="mt-auto pt-1">
                  <StarRating value={s.favorite_score} size="text-sm" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

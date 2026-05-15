import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { listSeries } from "../api/series.js";
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
      <h1 className="text-lg font-bold text-slate-700">完結・読破済み</h1>

      {loading ? (
        <p className="py-10 text-center text-sm text-slate-400">読み込み中…</p>
      ) : series.length === 0 ? (
        <p className="py-10 text-center text-sm text-slate-400">
          読破済みのシリーズはまだありません。
        </p>
      ) : (
        series.map((s) => (
          <Link
            key={s.id}
            to={`/series/${s.id}`}
            className="flex items-center justify-between rounded-lg bg-white p-3 shadow-sm"
          >
            <div>
              <div className="font-bold text-slate-800">{s.title}</div>
              <div className="text-xs text-slate-500">
                全{s.total_volumes ?? s.current_volume}巻 読破
              </div>
            </div>
            <StarRating value={s.favorite_score} size="text-sm" />
          </Link>
        ))
      )}
    </div>
  );
}

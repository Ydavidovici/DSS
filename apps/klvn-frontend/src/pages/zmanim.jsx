import { useEffect, useState } from "react";

export default function Zmanim() {
    const [data, setData] = useState(null);
    const [err, setErr] = useState(null);

    useEffect(() => {
        fetch("/api/zmanim/latest", { credentials: "include" })
            .then(r => r.ok ? r.json() : Promise.reject(r.statusText))
            .then(setData)
            .catch(e => setErr(e?.toString() || "Error"));
    }, []);

    if (err) return <p className="text-red-600">Failed to load: {String(err)}</p>;
    if (!data) return <p>Loading…</p>;

    return (
        <section className="space-y-3">
            <h2 className="text-2xl font-bold">Weekly Zmanim</h2>
            <ul className="divide-y">
                <li className="py-1"><strong>Shacharis:</strong> {data.shacharis ?? "-"}</li>
                <li className="py-1"><strong>Mincha:</strong> {data.mincha ?? "-"}</li>
                <li className="py-1"><strong>Maariv:</strong> {data.maariv ?? "-"}</li>
            </ul>
            {data.notes && <p className="italic text-slate-600">{data.notes}</p>}
        </section>
    );
}

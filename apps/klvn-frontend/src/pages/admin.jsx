import { useEffect, useState } from "react";

function Login({ onAuthed }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    async function submit(e) {
        e.preventDefault();
        const res = await fetch("/auth/login", {
            method: "POST",
            headers: { "Content-Type":"application/json" },
            credentials: "include", // receive HttpOnly cookie from auth-service
            body: JSON.stringify({ email, password })
        });
        if (!res.ok) return alert("Login failed");
        onAuthed(true);
    }

    return (
        <form onSubmit={submit} className="grid gap-3 max-w-sm">
            <h2 className="text-xl font-semibold">Admin Login</h2>
            <input className="border rounded px-2 py-1" placeholder="Email" value={email} onChange={e=>setEmail(e.target.value)} />
            <input className="border rounded px-2 py-1" placeholder="Password" type="password" value={password} onChange={e=>setPassword(e.target.value)} />
            <button className="bg-black text-white rounded px-3 py-2">Log in</button>
        </form>
    );
}

function ZmanimForm() {
    const [form, setForm] = useState({ weekOf:"", shacharis:"", mincha:"", maariv:"", notes:"" });
    const set = (k,v)=> setForm(s=>({ ...s, [k]:v }));

    async function save(e){
        e.preventDefault();
        const res = await fetch("/api/zmanim", {
            method: "POST",
            headers: { "Content-Type":"application/json" },
            credentials: "include",  // send cookie to backend
            body: JSON.stringify(form)
        });
        if (!res.ok) return alert("Save failed");
        alert("Saved!");
    }

    return (
        <form onSubmit={save} className="grid gap-3 max-w-md">
            <h2 className="text-xl font-semibold">Update Weekly Zmanim</h2>
            <label className="grid gap-1">
                <span>Week Of</span>
                <input type="date" className="border rounded px-2 py-1" value={form.weekOf} onChange={e=>set("weekOf", e.target.value)} />
            </label>
            <label className="grid gap-1">
                <span>Shacharis</span>
                <input className="border rounded px-2 py-1" value={form.shacharis} onChange={e=>set("shacharis", e.target.value)} />
            </label>
            <label className="grid gap-1">
                <span>Mincha</span>
                <input className="border rounded px-2 py-1" value={form.mincha} onChange={e=>set("mincha", e.target.value)} />
            </label>
            <label className="grid gap-1">
                <span>Maariv</span>
                <input className="border rounded px-2 py-1" value={form.maariv} onChange={e=>set("maariv", e.target.value)} />
            </label>
            <label className="grid gap-1">
                <span>Notes</span>
                <textarea className="border rounded px-2 py-1" value={form.notes} onChange={e=>set("notes", e.target.value)} />
            </label>
            <button className="bg-black text-white rounded px-3 py-2">Save</button>
        </form>
    );
}

export default function Admin() {
    const [authed, setAuthed] = useState(false);
    const [loading, setLoading] = useState(true);

    useEffect(()=>{
        fetch("/auth/me", { credentials:"include" })
            .then(r => setAuthed(r.ok))
            .finally(() => setLoading(false));
    },[]);

    if (loading) return <p>Loading…</p>;
    return authed ? <ZmanimForm/> : <Login onAuthed={setAuthed} />;
}

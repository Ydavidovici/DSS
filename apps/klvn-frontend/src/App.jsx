import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import Home from "./pages/home.jsx";
import Zmanim from "./pages/zmanim.jsx";
import Admin from "./pages/admin.jsx";

export default function App() {
    return (
        <BrowserRouter>
            <header className="max-w-5xl mx-auto p-4 flex items-center justify-between border-b">
                <h1 className="text-xl font-semibold">Kehilas Lev Vnefesh</h1>
                <nav className="flex gap-4">
                    <Link to="/" className="hover:underline">Home</Link>
                    <Link to="/zmanim" className="hover:underline">Zmanim</Link>
                    <Link to="/admin" className="hover:underline">Admin</Link>
                </nav>
            </header>
            <main className="max-w-5xl mx-auto p-4">
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/zmanim" element={<Zmanim />} />
                    <Route path="/admin" element={<Admin />} />
                </Routes>
            </main>
        </BrowserRouter>
    );
}

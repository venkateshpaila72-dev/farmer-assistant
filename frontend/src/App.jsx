import { Routes, Route } from "react-router-dom";
import Home from "./pages/public/Home.jsx";

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center text-ink-soft">
      Page not found.
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default App;
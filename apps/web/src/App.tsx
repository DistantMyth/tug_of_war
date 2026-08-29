import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ToastContainer } from "./components/common/ToastContainer.js";
import { AdminPage } from "./pages/AdminPage.js";
import { DisplayPage } from "./pages/DisplayPage.js";
import { GamePage } from "./pages/GamePage.js";
import { JoinPage } from "./pages/JoinPage.js";

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/join" replace />} />
        <Route path="/join" element={<JoinPage />} />
        <Route path="/game" element={<GamePage />} />
        <Route path="/display" element={<DisplayPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
      <ToastContainer />
    </BrowserRouter>
  );
}


import { Routes, Route, Navigate } from "react-router-dom";
import Register from './components/user/Register';

export default function App() {
    return (
        <Routes>
            <Route path="/" element={<Navigate to="/crear-cuenta" />} />
            <Route path="/crear-cuenta" element={<Register />} />
        </Routes>
    )
}
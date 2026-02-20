import { Routes, Route, Navigate } from "react-router-dom";
import Layout from "@/components/Layout";
import OrgChart from "@/pages/OrgChart";
import Workspaces from "@/pages/Workspaces";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/org" replace />} />
        <Route path="/org" element={<OrgChart />} />
        <Route path="/workspaces" element={<Workspaces />} />
        <Route path="/workspaces/:agentId" element={<Workspaces />} />
      </Route>
    </Routes>
  );
}

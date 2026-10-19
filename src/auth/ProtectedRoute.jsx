import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthContext";

export default function ProtectedRoute({ children }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex w-full items-center justify-center py-16" role="status">
        <p className="text-base text-ink-muted">Restoring your session…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/sign-in" replace state={{ from: location }} />;
  return children;
}

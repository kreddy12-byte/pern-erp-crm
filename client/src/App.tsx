import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import { LoginPage } from "./pages/LoginPage";
import { SignupPage } from "./pages/SignupPage";
import { GoogleCallbackPage } from "./pages/GoogleCallbackPage";
import { AppHomePage } from "./pages/AppHomePage";
import { EnquiriesPage } from "./pages/EnquiriesPage";
import { QuotationsPage } from "./pages/QuotationsPage";
import { SalesOrdersPage } from "./pages/SalesOrdersPage";
import { InventoryPage } from "./pages/InventoryPage";
import { DispatchesPage } from "./pages/DispatchesPage";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/app" element={<AppHomePage />} />
            <Route path="/app/enquiries" element={<EnquiriesPage />} />
            <Route path="/app/quotations" element={<QuotationsPage />} />
            <Route path="/app/sales-orders" element={<SalesOrdersPage />} />
            <Route path="/app/inventory" element={<InventoryPage />} />
            <Route path="/app/dispatches" element={<DispatchesPage />} />
          </Route>
          <Route path="/" element={<Navigate to="/app" replace />} />
          <Route path="*" element={<Navigate to="/app" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

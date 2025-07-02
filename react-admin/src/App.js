import React from "react";
import { useState, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate} from "react-router-dom";
import Topbar from "./scenes/global/Topbar";
import Sidebar from "./scenes/global/Sidebar";
import Dashboard from "./scenes/dashboard";
import Team from "./scenes/team";
import Invoices from "./scenes/invoices";
import MachineRate from "./scenes/machinerate";
import MachineType from "./scenes/machinetype";
import Make from "./scenes/machinemake";
import ItemMaster from "./scenes/itemmaster";
import CostAggregate from "./scenes/costaggregate"
import Country from "./scenes/country"
import Contacts from "./scenes/contacts";
import Bar from "./scenes/bar";
import Form from "./scenes/form";
import Line from "./scenes/line";
import Pie from "./scenes/pie";
import FAQ from "./scenes/faq";
import Login from "./scenes/login/Login";
import Geography from "./scenes/geography";
import { CssBaseline, ThemeProvider } from "@mui/material";
import { ColorModeContext, useMode } from "./theme";
import Calendar from "./scenes/calendar/calendar";
import ProcessFlowMatrix from "./scenes/processflow";
import { toast } from "react-toastify";
import ModelSize from "./scenes/modelsize";
import Charts from "./scenes/charts";
const PrivateRoute = ({ children }) => {
  const navigate = useNavigate();
  const [isAuthenticated, setIsAuthenticated] = useState(null);

  useEffect(() => {
      const token = localStorage.getItem("token");
      const exp = localStorage.getItem("exp");

      // ✅ Check if the token is missing or expired
      if (!token || (exp && Date.now() >= Number(exp))) {
          localStorage.clear();
          toast.warn("Session expired! Redirecting to login...");
          setTimeout(() => navigate("/login"), 1000);
          setIsAuthenticated(false);
      } else {
          setIsAuthenticated(true);
      }
  }, [navigate]);

  if (isAuthenticated === null) return null; // ✅ Prevent rendering until authentication is checked

  return isAuthenticated ? children : <Navigate to="/login" />;
};


function App() {
  const [theme, colorMode] = useMode();
  const [isSidebar, setIsSidebar] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();
  
  const token = localStorage.getItem("token");
  const isAuthenticated = !!token; // ✅ Convert to boolean to check if logged in


  // ✅ Hide Sidebar & Topbar on Login Page
  const showSidebar = location.pathname !== "/login";
  const showTopbar = location.pathname !== "/login";

  useEffect(() => {
    if (isAuthenticated) {
      resetInactivityTimeout();

      document.addEventListener("mousemove", resetInactivityTimeout);
      document.addEventListener("keypress", resetInactivityTimeout);
  }

  return () => {
      clearTimeout(inactivityTimeout);
      document.removeEventListener("mousemove", resetInactivityTimeout);
      document.removeEventListener("keypress", resetInactivityTimeout);
  };
}, [isAuthenticated]);

let inactivityTimeout;

const resetInactivityTimeout = () => {
    clearTimeout(inactivityTimeout);
    inactivityTimeout = setTimeout(() => {
        alert("You were inactive for too long. Logging out...");
        handleLogout();
    }, 600000); // 10 minutes
};

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login");
  };

  return (
    <ColorModeContext.Provider value={colorMode}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        <div className="app">
          {showSidebar && <Sidebar isSidebar={isSidebar} /> }
          <main className="content">
            {showTopbar && <Topbar setIsSidebar={setIsSidebar} />}
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
              <Route path="/team" element={<PrivateRoute><Team /></PrivateRoute>} />
              <Route path="/contacts" element={<PrivateRoute><Contacts /></PrivateRoute>} />
              <Route path="/country" element={<PrivateRoute><Country /></PrivateRoute>}/>
              <Route path="/invoices" element={<PrivateRoute><Invoices /></PrivateRoute>} />
              <Route path="/machinerate" element={<PrivateRoute><MachineRate /></PrivateRoute>} />
              <Route path="/machinetype" element={<PrivateRoute><MachineType /></PrivateRoute>} />
              <Route path="/make" element = {<PrivateRoute><Make /></PrivateRoute>} />
              <Route path="/modelsize" element = {<PrivateRoute><ModelSize /></PrivateRoute>} />
              <Route path="/itemmaster" element={<PrivateRoute><ItemMaster /></PrivateRoute>} />
              <Route path="/processflow" element={<PrivateRoute><ProcessFlowMatrix /></PrivateRoute>} />
              <Route path="/costaggregate" element={<PrivateRoute><CostAggregate /></PrivateRoute>} />
              <Route path="/form" element={<PrivateRoute><Form /></PrivateRoute>} />
              <Route path="/bar" element={<PrivateRoute><Bar /></PrivateRoute>} />
              <Route path="/pie" element={<PrivateRoute><Pie /></PrivateRoute>} />
              <Route path="/line" element={<PrivateRoute><Line /></PrivateRoute>} />
              <Route path="/faq" element={<PrivateRoute><FAQ /></PrivateRoute>} />
              <Route path="/calendar" element={<PrivateRoute><Calendar /></PrivateRoute>} />
              <Route path="/geography" element={<PrivateRoute><Geography /></PrivateRoute>} />
              <Route path="/charts" element={<PrivateRoute><Charts /></PrivateRoute>} />
              <Route path="*" element={<Navigate to="/login" />} />
            </Routes>
          </main>
        </div>
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}

export default App;
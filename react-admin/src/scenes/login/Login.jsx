import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Box, Button, TextField, Typography, Paper } from "@mui/material";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
//import API from "../../api";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

const Login = () => {
    const [credentials, setCredentials] = useState({ username: "", password: "" });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        checkTokenExpiration();
        resetInactivityTimeout();
    }, []);

    const handleLogin = async () => {
        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/login`, credentials, {
                headers: { "Content-Type": "application/json" }  // ✅ Ensure JSON request
            });

            console.log(response.data);
            const { access_token, role } = response.data; // ✅ Proper destructuring

            if (!access_token) {
                throw new Error("No token received from server!");
            }

            const payload = JSON.parse(atob(access_token.split(".")[1]));
            const exp = payload.exp * 1000;
            
            // ✅ Store token and role in localStorage
            localStorage.setItem("token", access_token);
            localStorage.setItem("role", role);
            localStorage.setItem("exp",exp);

            
            toast.success("Login successful!");
            resetInactivityTimeout();toast.success("Login successful!");

            // ✅ Redirect to Dashboard after login
            navigate("/");
        } catch (error) {
            console.error("Login Error:", error);
            toast.error("Invalid credentials. Please try again.");
        }
        setLoading(false);
    };

    const checkTokenExpiration = () => {
        const exp = localStorage.getItem("exp");
        if (exp && Date.now() >= exp) {
            logout();
        } else {
            setTimeout(logout, exp - Date.now()); // Auto logout on expiration
        }
    };

    let inactivityTimeout;
    const resetInactivityTimeout = () => {
        clearTimeout(inactivityTimeout);
        inactivityTimeout = setTimeout(() => {
            alert("You were inactive for too long. Logging out...");
            logout();
        }, 600000); // 10 minutes
    };

    document.addEventListener("mousemove", resetInactivityTimeout);
    document.addEventListener("keypress", resetInactivityTimeout);

    const logout = () => {
        localStorage.removeItem("token");
        localStorage.removeItem("role");
        localStorage.removeItem("exp");
        navigate("/login");
    };

    return (
        <Box display="flex" justifyContent="center" alignItems="center" height="100vh">
            <Paper elevation={3} sx={{ padding: 4, width: 350, textAlign: "center" }}>
                <Typography variant="h4" mb={2}>Login</Typography>

                <TextField
                    label="Username"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={credentials.username}
                    onChange={(e) => setCredentials({ ...credentials, username: e.target.value })}
                />
                <TextField
                    label="Password"
                    type="password"
                    variant="outlined"
                    fullWidth
                    margin="normal"
                    value={credentials.password}
                    onChange={(e) => setCredentials({ ...credentials, password: e.target.value })}
                />

                <Button
                    variant="contained"
                    color="primary"
                    fullWidth
                    onClick={handleLogin}
                    disabled={loading}
                    sx={{ mt: 2 }}
                >
                    {loading ? "Logging in..." : "Login"}
                </Button>

                <ToastContainer />
            </Paper>
        </Box>
    );
};

export default Login;

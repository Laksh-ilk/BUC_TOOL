//Currently not using this file
import axios from "axios";

// Set up the base URL
const API = axios.create({
    baseURL: "http://127.0.0.1:8000",  // Change if backend URL changes
});

// Attach JWT token to requests
API.interceptors.request.use((config) => {
    const token = localStorage.getItem("token");
    if (token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export default API;

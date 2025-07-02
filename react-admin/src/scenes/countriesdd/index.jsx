import React, { useEffect, useState } from "react";
import { InputLabel, Select, MenuItem, FormControl } from "@mui/material";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";
const CountryDropdown = ({ selectedCountry, setSelectedCountry }) => {
    const [countries, setCountries] = useState([]);

    useEffect(() => {
        const fetchCountries = async () => {
            try {
                const response = await axios.get(`${API_BASE_URL}/fetch-countries`);
                if (Array.isArray(response.data)) {
                    setCountries(response.data);
                } else if (Array.isArray(response.data.countries)) {
                    setCountries(response.data.countries);
                } else {
                    console.error("Invalid country data:", response.data);
                    setCountries([]);
                }
            } catch (error) {
                console.error("Error fetching countries:", error);
                //setCountries([]);
            }
        };
        fetchCountries();
    }, []);

    return (
        <FormControl fullWidth variant="outlined" size="small">
        <InputLabel id="country-label" shrink={!!selectedCountry} sx={{ fontSize: '0.875rem' }}>Country</InputLabel>
        <Select
            labelId="country-label"
            value={selectedCountry}
            onChange={(e) => setSelectedCountry(e.target.value)}
            label="Country"
            fullWidth
            size="small"
        >
            {countries.map((country) => (
                <MenuItem key={country.id} value={country.name}>
                    {country.name}
                </MenuItem>
            ))}
        </Select>
        </FormControl>
    );
};

export default CountryDropdown;

import React, { useEffect, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, TextField, Select, MenuItem, FormControl, InputLabel } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { ToastContainer, toast } from "react-toastify";
import { tokens } from "../../theme";
import { useTheme } from "@mui/material";
import "react-toastify/dist/ReactToastify.css";
import axios from "axios";
import Header from "../../components/Header";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

// Predefined list of countries with their currency symbols
const COUNTRIES = [
    { name: "United States", currency_symbol: "$" },
    { name: "United Kingdom", currency_symbol: "£" },
    { name: "European Union", currency_symbol: "€" },
    { name: "Japan", currency_symbol: "¥" },
    { name: "China", currency_symbol: "¥" },
    { name: "India", currency_symbol: "₹" },
    { name: "Canada", currency_symbol: "C$" },
    { name: "Australia", currency_symbol: "A$" },
    { name: "Brazil", currency_symbol: "R$" },
    { name: "Russia", currency_symbol: "₽" },
    { name: "South Korea", currency_symbol: "₩" },
    { name: "Mexico", currency_symbol: "$" },
    { name: "Singapore", currency_symbol: "S$" },
    { name: "Switzerland", currency_symbol: "CHF" },
    { name: "South Africa", currency_symbol: "R" },
    { name: "New Zealand", currency_symbol: "NZ$" },
    { name: "Saudi Arabia", currency_symbol: "ر.س" },
    { name: "United Arab Emirates", currency_symbol: "د.إ" },
    { name: "Turkey", currency_symbol: "₺" },
    { name: "Indonesia", currency_symbol: "Rp" },
    { name: "Thailand", currency_symbol: "฿" },
    { name: "Malaysia", currency_symbol: "RM" },
    { name: "Philippines", currency_symbol: "₱" },
    { name: "Vietnam", currency_symbol: "₫" },
    { name: "Egypt", currency_symbol: "E£" },
    { name: "Nigeria", currency_symbol: "₦" },
    { name: "Kenya", currency_symbol: "KSh" },
    { name: "Israel", currency_symbol: "₪" },
    { name: "Argentina", currency_symbol: "$" },
    { name: "Chile", currency_symbol: "$" }
];

// Axios instance with auth header
const getAuthAxios = () => {
  const token = localStorage.getItem("token");
  return axios.create({
    baseURL: API_BASE_URL,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });
};

const CountryPage = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const [countries, setCountries] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [openEditDialog, setOpenEditDialog] = useState(false);
    const [editingCountry, setEditingCountry] = useState(null);
    const [newCountry, setNewCountry] = useState({
        name: "",
        currency_symbol: "",
        labor_rate: "",
        electricity_rate: "",
        water_rate: "",
        space_rental_rate: "",
        exchange_rate: ""
    });

    useEffect(() => {
        fetchCountries();
    }, []);

    const fetchCountries = async () => {
        try {
            const response = await getAuthAxios().get(`/fetch-countries`);
            setCountries(response.data);
        } catch (error) {
            toast.error("Error fetching countries!");
        }
    };

    const handleCreateCountry = async () => {
        try {
            await getAuthAxios().post(`/create-country`, newCountry);
            toast.success("Country added successfully!");
            setOpenCreateDialog(false);
            setNewCountry({
                name: "",
                currency_symbol: "",
                labor_rate: "",
                electricity_rate: "",
                water_rate: "",
                space_rental_rate: "",
                exchange_rate: ""
            });
            fetchCountries();
        } catch (error) {
            if (error.response?.data?.detail?.includes("Duplicate entry")) {
                toast.error("A country with this name already exists!");
            } else {
                toast.error("Error adding country!");
            }
        }
    };

    const handleEditCountry = async () => {
        try {
            await getAuthAxios().put(`/update-country/${editingCountry.id}`, editingCountry);
            toast.success("Country updated successfully!");
            setOpenEditDialog(false);
            setEditingCountry(null);
            fetchCountries();
        } catch (error) {
            toast.error("Error updating country!");
        }
    };

    const handleDeleteCountries = async () => {
        try {
            await getAuthAxios().delete(`/delete-countries`, { data: { ids: selectedRows } });
            toast.success("Countries deleted successfully!");
            setSelectedRows([]);
            fetchCountries();
        } catch (error) {
            console.error('Error deleting countries:', error);
            toast.error(error.response?.data?.detail || 'Error deleting countries');
        }
    };

    const handleCountrySelect = (countryName) => {
        const selectedCountry = COUNTRIES.find(country => country.name === countryName);
        if (selectedCountry) {
            setNewCountry(prev => ({
                ...prev,
                name: selectedCountry.name,
                currency_symbol: selectedCountry.currency_symbol
            }));
        }
    };

    const columns = [
        { field: "id", headerName: "ID", flex: 0.5 },
        { field: "name", headerName: "Country Name", flex: 1 },
        { field: "currency_symbol", headerName: "Currency Symbol", flex: 1 },
        { field: "labor_rate", headerName: "Labor Rate", flex: 1 },
        { field: "electricity_rate", headerName: "Electricity Rate", flex: 1 },
        { field: "water_rate", headerName: "Water Rate", flex: 1 },
        { field: "space_rental_rate", headerName: "Space Rental Rate", flex: 1 },
        {
            field: "actions",
            headerName: "Actions",
            flex: 1,
            renderCell: (params) => (
                <Button
                    variant="contained"
                    color="primary"
                    onClick={() => {
                        setEditingCountry(params.row);
                        setOpenEditDialog(true);
                    }}
                >
                    Edit
                </Button>
            ),
        },
    ];

    return (
        <Box m="20px">
            <Header title="Country Management" subtitle="Manage countries and their rates" />
            <Box display="flex" justifyContent="space-between" mb="10px">
                <Button variant="contained" color="primary" onClick={() => setOpenCreateDialog(true)}>
                    Add Country
                </Button>
                {selectedRows.length > 0 && (
                    <Button variant="contained" color="error" onClick={handleDeleteCountries}>
                        Delete Selected ({selectedRows.length})
                    </Button>
                )}
            </Box>
            <Box m="40px 0 0 0"
            height="75vh"
            sx={{
            "& .MuiDataGrid-root": {
                border: "none",
            },
            "& .MuiDataGrid-cell": {
                borderBottom: "none",
            },
            "& .name-column--cell": {
                color: colors.greenAccent[300],
            },
            "& .MuiDataGrid-columnHeaders": {
                backgroundColor: colors.blueAccent[700],
                borderBottom: "none",
            },
            "& .MuiDataGrid-virtualScroller": {
                backgroundColor: colors.primary[400],
            },
            "& .MuiDataGrid-footerContainer": {
                borderTop: "none",
                backgroundColor: colors.blueAccent[700],
            },
            "& .MuiCheckbox-root":{
                color:`${colors.greenAccent[200]} !important`,
            },
            "& .MuiDataGrid-toolbarContainer .MuiButton-text": {
                color: `${colors.grey[100]} !important`,
            },
            }}>
                <DataGrid
                    rows={countries}
                    columns={columns}
                    getRowId={(row) => row.id}
                    checkboxSelection
                    onSelectionModelChange={(ids) => setSelectedRows(ids)}
                    components={{ Toolbar: GridToolbar }}
                />
            </Box>
            <ToastContainer />
            <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)}>
                <DialogTitle>Add New Country</DialogTitle>
                <DialogContent>
                    <FormControl fullWidth margin="dense">
                        <InputLabel>Country</InputLabel>
                        <Select
                            value={newCountry.name}
                            onChange={(e) => handleCountrySelect(e.target.value)}
                            label="Country"
                        >
                            {COUNTRIES.map((country) => (
                                <MenuItem key={country.name} value={country.name}>
                                    {country.name}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                    <TextField
                        label="Currency Symbol"
                        fullWidth
                        margin="dense"
                        value={newCountry.currency_symbol}
                        disabled
                    />
                    <TextField
                        label="Labor Rate"
                        fullWidth
                        margin="dense"
                        value={newCountry.labor_rate}
                        onChange={(e) => setNewCountry({ ...newCountry, labor_rate: e.target.value })}
                        type="number"
                    />
                    <TextField
                        label="Electricity Rate"
                        fullWidth
                        margin="dense"
                        value={newCountry.electricity_rate}
                        onChange={(e) => setNewCountry({ ...newCountry, electricity_rate: e.target.value })}
                        type="number"
                    />
                    <TextField
                        label="Water Rate"
                        fullWidth
                        margin="dense"
                        value={newCountry.water_rate}
                        onChange={(e) => setNewCountry({ ...newCountry, water_rate: e.target.value })}
                        type="number"
                    />
                    <TextField
                        label="Space Rental Rate"
                        fullWidth
                        margin="dense"
                        value={newCountry.space_rental_rate}
                        onChange={(e) => setNewCountry({ ...newCountry, space_rental_rate: e.target.value })}
                        type="number"
                    />
                    <TextField
                        label="Exchange Rate"
                        fullWidth
                        margin="dense"
                        value={newCountry.exchange_rate}
                        onChange={(e) => setNewCountry({ ...newCountry, exchange_rate: e.target.value })}
                        type="number"
                    />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
                    <Button onClick={handleCreateCountry} color="primary">Add</Button>
                </DialogActions>
            </Dialog>
            <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)}>
                <DialogTitle>Edit Country</DialogTitle>
                <DialogContent>
                    {editingCountry && (
                        <>
                            <TextField
                                label="Name"
                                fullWidth
                                margin="dense"
                                value={editingCountry.name}
                                disabled
                            />
                            <TextField
                                label="Currency Symbol"
                                fullWidth
                                margin="dense"
                                value={editingCountry.currency_symbol}
                                disabled
                            />
                            <TextField
                                label="Labor Rate"
                                fullWidth
                                margin="dense"
                                value={editingCountry.labor_rate}
                                onChange={(e) => setEditingCountry({ ...editingCountry, labor_rate: e.target.value })}
                                type="number"
                            />
                            <TextField
                                label="Electricity Rate"
                                fullWidth
                                margin="dense"
                                value={editingCountry.electricity_rate}
                                onChange={(e) => setEditingCountry({ ...editingCountry, electricity_rate: e.target.value })}
                                type="number"
                            />
                            <TextField
                                label="Water Rate"
                                fullWidth
                                margin="dense"
                                value={editingCountry.water_rate}
                                onChange={(e) => setEditingCountry({ ...editingCountry, water_rate: e.target.value })}
                                type="number"
                            />
                            <TextField
                                label="Space Rental Rate"
                                fullWidth
                                margin="dense"
                                value={editingCountry.space_rental_rate}
                                onChange={(e) => setEditingCountry({ ...editingCountry, space_rental_rate: e.target.value })}
                                type="number"
                            />
                            <TextField
                                label="Exchange Rate"
                                fullWidth
                                margin="dense"
                                value={editingCountry.exchange_rate}
                                onChange={(e) => setEditingCountry({ ...editingCountry, exchange_rate: e.target.value })}
                                type="number"
                            />
                        </>
                    )}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
                    <Button onClick={handleEditCountry} color="primary">Save</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default CountryPage;

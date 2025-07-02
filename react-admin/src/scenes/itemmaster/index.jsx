import React, { useEffect, useState } from "react";
import { Box, Button, Dialog, DialogActions,DialogContentText, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import Header from "../../components/Header";
import { tokens } from "../../theme";
import axios from "axios";
import { useTheme } from "@mui/material";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000"; 

const ItemMaster = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const [data, setData] = useState([]);
    const [selectedRows, setSelectedRows] = useState([]);
    const [deletedRows, setDeletedRows] = useState([]);
    const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [selectedFile, setSelectedFile] = useState(null);
    const [relatedData, setRelatedData] = useState({
        machine_rate: [],
        cost_aggregate: [],
        process_flow_matrix: []
    });
    const [selectedItemMaster, setSelectedItemMaster] = useState(null);
    const [openPreviewDialog, setOpenPreviewDialog] = useState(false);
    
    const [newRecord, setNewRecord] = useState({
        part_number: "",
        description: "",
        category: "",
        model: "",
        uom: "",
        material: "",
        weight: "",
        dimensions: "",
        color: "",
        supplier: "",
        cost_per_unit: "",
        min_order_qty: "",
        annual_volume: "",
        lifetime_volume: "",
        compliance_standards: "",
        lifecycle_stage: "",
        drawing_number: "",
        revision_number: "",
    });

    useEffect(() => {
        fetchItemMasterData();
    }, []);

    const fetchItemMasterData = () => {
        axios.get(`${API_BASE_URL}/fetch-item-masters`)
            .then(response => setData(response.data))
            .catch(error => console.error("Error fetching item master data:", error));
    };

    const handleCreateNewRecord = async () => {
        try {
            const token = localStorage.getItem("token");
            if (!token) {
                toast.error("Authentication required. Please log in.");
                return;
            }

            await axios.post(`${API_BASE_URL}/create-item-master`, newRecord, {
                headers: { 
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                }
            });
            toast.success("New Item Master record created!");
            setOpenCreateDialog(false);
            fetchItemMasterData();
        } catch (error) {
            console.error("Error creating item master record:", error);
            toast.error(error.response?.data?.message || "Failed to create record");
        }
    };

    const handleFileChange = (event) => {
        setSelectedFile(event.target.files[0]);
    };

    const handleBulkUpload = async () => {
        try {
            if (!selectedFile) {
                toast.warn("Please select a file to upload.");
                return;
            }

            const token = localStorage.getItem("token");
            if (!token) {
                toast.error("Authentication required. Please log in.");
                return;
            }

            const formData = new FormData();
            formData.append("file", selectedFile);

            await axios.post(`${API_BASE_URL}/bulk-upload-item-master`, formData, {
                headers: {
                    "Content-Type": "multipart/form-data",
                    Authorization: `Bearer ${token}`
                }
            });
            toast.success("Bulk Upload Successful!");
            fetchItemMasterData();
            setSelectedFile(null); // Reset file input
        } catch (error) {
            console.error("Error in bulk upload:", error);
            toast.error(error.response?.data?.message || "Failed to upload file");
        }
    };

//Temporary Delete
    const handleDelete = () => {
            if (selectedRows.length === 0) {
                toast.warn("No rows selected!");
                return;
            }
            setOpenDeleteDialog(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedItemMaster) {
            toast.warn("Please select an Item Master to delete!");
            return;
        }

        const token = localStorage.getItem("token");
        if (!token) {
            toast.error("Authentication required. Please log in.");
            return;
        }
    
        try {
            await axios.delete(`${API_BASE_URL}/delete-item-master/${selectedItemMaster}`,  {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            toast.success("Item Master and related data deleted successfully!");
            setOpenPreviewDialog(false);
            fetchItemMasterData(); // Refresh table
        } catch (error) {
            console.error("Error deleting Item Master:", error);
            toast.error("Failed to delete Item Master.");
        }
    };
    

    const handlePreviewBeforeDelete = async () => {

        if (selectedRows.length === 0) {
            toast.warn("Please select an Item Master to preview before deleting!");
            return;
        }

        const token = localStorage.getItem("token");
        if (!token) {
            toast.error("Authentication required. Please log in.");
            return;
        }

        const itemMasterId = selectedRows[0];
        
        try {
            const response = await axios.get(`${API_BASE_URL}/fetch-item-master-relations/${itemMasterId}`, {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });
            setRelatedData(response.data);
            setSelectedItemMaster(itemMasterId);
            setOpenPreviewDialog(true);
        } catch (error) {
            console.error("Error fetching related data:", error);
            toast.error("Failed to fetch related records.");
        }
    };
    

    const columns = Object.keys(newRecord).map((key) => ({
        field: key,
        headerName: key.replace(/_/g, " ").toUpperCase(),
        flex: 1,
        editable: true,
    }));

    return (
        <Box m="20px">
            <Header title="ITEM MASTER" subtitle="Manage Item Master Records" />

            <Box display="flex" justifyContent="space-between" mb="10px">
                <Button variant="contained" color="primary" onClick={() => setOpenCreateDialog(true)}>
                    Create New Item
                </Button>
                <input type="file" onChange={handleFileChange} />
                <Button variant="contained" color="secondary" onClick={handleBulkUpload} disabled={!selectedFile}>
                    Bulk Upload
                </Button>
                <Button variant="contained" color="error" onClick={handlePreviewBeforeDelete} 
                        disabled={selectedRows.length === 0}>
                    Delete
                </Button>

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
                    rows={data}
                    columns={columns}
                    getRowId={(row) => row.id}
                    checkboxSelection
                    onSelectionModelChange={(ids) => setSelectedRows(ids)}
                    components={{ Toolbar: GridToolbar }}
                />
            </Box>

            <ToastContainer />

            <Dialog open={openPreviewDialog} onClose={() => setOpenPreviewDialog(false)}>
                <DialogTitle>Confirm Deletion</DialogTitle>
                    <DialogContent>
                        <DialogContentText>
                                Are you sure you want to delete this Item Master? This will also delete the following related records:
                        </DialogContentText>

                    <Box>
                        <Typography variant="h6">Machine Rate</Typography>
                            {relatedData.machine_rate.length > 0 ? (
                                relatedData.machine_rate.map((record, index) => (
                        <Typography key={index}>Machine Type: {record.machine_type}, Make: {record.make}</Typography>
                        ))
                        ) : (
                        <Typography>No related machine rate records</Typography>
                        )}

                        <Typography variant="h6">Cost Aggregate</Typography>
                        {relatedData.cost_aggregate.length > 0 ? (
                            relatedData.cost_aggregate.map((record, index) => (
                                <Typography key={index}>Cost: {record.total_cost}</Typography>
                            ))
                        ) : (
                            <Typography>No related cost aggregate records</Typography>
                        )}

                        <Typography variant="h6">Process Flow Matrix</Typography>
                        {relatedData.process_flow_matrix.length > 0 ? (
                            relatedData.process_flow_matrix.map((record, index) => (
                                <Typography key={index}>Process Name: {record.process_name}</Typography>
                            ))
                        ) : (
                            <Typography>No related process flow matrix records</Typography>
                        )}
                    </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenPreviewDialog(false)}>Cancel</Button>
                    <Button onClick={handleConfirmDelete} color="error">Delete</Button>
                </DialogActions>
            </Dialog>


            {/* Create New Record Dialog */}
            <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)}>
                <DialogTitle>Create New Item Master</DialogTitle>
                <DialogContent>
                    {Object.keys(newRecord).map((key) => (
                        <TextField
                            key={key}
                            label={key.replace(/_/g, " ").toUpperCase()}
                            fullWidth
                            margin="dense"
                            onChange={(e) => setNewRecord({ ...newRecord, [key]: e.target.value })}
                        />
                    ))}
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
                    <Button onClick={handleCreateNewRecord} color="primary">Create</Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ItemMaster;

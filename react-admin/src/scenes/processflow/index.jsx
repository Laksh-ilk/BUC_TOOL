import React, { useEffect, useState } from "react";
import { 
  Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, 
  DialogTitle, TextField, Select, MenuItem, CircularProgress, FormControl,
  InputLabel, FormHelperText, Grid, Typography
} from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { tokens } from "../../theme";
import Header from "../../components/Header";
import axios from "axios";
import { useTheme } from "@mui/material";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ItemMasterDropdown from "../itmasdd.jsx";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

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

const ProcessFlow = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const [data, setData] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [selectedItemMaster, setSelectedItemMaster] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [machineTypes, setMachineTypes] = useState([]);

  // New record state
    const [newRecord, setNewRecord] = useState({
        operation: "",
        description: "",
        machine_type: "",
        cycle_time_sec: "",
        yield_percentage: "",
        operator_count: ""
    });

  // Fetch data when item master changes
  useEffect(() => {
    if (selectedItemMaster) {
      fetchProcessFlowData();
    }
  }, [selectedItemMaster]);

  // Fetch machine types on component mount
    useEffect(() => {
    const fetchMachineTypes = async () => {
      try {
        const response = await getAuthAxios().get("/fetch-machine-types");
        setMachineTypes(response.data);
      } catch (error) {
        console.error("Error fetching machine types:", error);
      }
    };
    fetchMachineTypes();
    }, []);

  const fetchProcessFlowData = async () => {
    if (!selectedItemMaster) return;
    
    setIsLoading(true);
    try {
      const response = await getAuthAxios().get(`/fetch-process-flows?item_master_id=${selectedItemMaster}`);
                setData(response.data);
    } catch (error) {
      toast.error("Error fetching data: " + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (field, value) => {
    setNewRecord(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear validation error
    if (validationErrors[field]) {
      setValidationErrors(prev => ({
        ...prev,
        [field]: undefined
      }));
    }
  };

  const validateForm = () => {
    const errors = {};
    const requiredFields = ["operation", "machine_type", "cycle_time_sec"];
    
    requiredFields.forEach(field => {
      if (!newRecord[field]) {
        errors[field] = `${field.replace(/_/g, " ")} is required`;
      }
    });

    // Validate numeric fields
    if (newRecord.cycle_time_sec && isNaN(Number(newRecord.cycle_time_sec))) {
      errors.cycle_time_sec = "Cycle time must be a number";
    }
    if (newRecord.yield_percentage && (isNaN(Number(newRecord.yield_percentage)) || 
        Number(newRecord.yield_percentage) < 0 || Number(newRecord.yield_percentage) > 100)) {
      errors.yield_percentage = "Yield percentage must be between 0 and 100";
    }
    if (newRecord.operator_count && (isNaN(Number(newRecord.operator_count)) || 
        Number(newRecord.operator_count) < 0)) {
      errors.operator_count = "Operator count must be a positive number";
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreate = async () => {
    if (!validateForm()) return;
    
    setIsLoading(true);
    try {
      const response = await getAuthAxios().post(`/create-process-flow`, {
        ...newRecord,
        item_master_id: selectedItemMaster
      });
      
      toast.success("Process flow created successfully!");
                setOpenCreateDialog(false);
      fetchProcessFlowData();
      resetNewRecordForm();
    } catch (error) {
      toast.error("Error creating process flow: " + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const resetNewRecordForm = () => {
    setNewRecord({
      operation: "",
      description: "",
      machine_type: "",
      cycle_time_sec: "",
      yield_percentage: "",
      operator_count: ""
    });
    setValidationErrors({});
  };

  const handleDelete = () => {
    if (selectedRows.length === 0) {
      toast.warn("Please select records to delete");
      return;
    }
    setOpenDeleteDialog(true);
  };

  const handleConfirmDelete = async () => {
    if (selectedRows.length === 0) {
      toast.warn("No records selected for deletion");
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await getAuthAxios().post(`/delete-process-flow`, { ids: selectedRows });
      
      setData(prevData => prevData.filter(row => !selectedRows.includes(row.id)));
      toast.success(response.data.message || `${selectedRows.length} record(s) deleted successfully!`);
      setSelectedRows([]);
      setOpenDeleteDialog(false);
      await fetchProcessFlowData();
    } catch (error) {
      toast.error("Error deleting records: " + (error.response?.data?.message || error.message));
      await fetchProcessFlowData();
    } finally {
      setIsLoading(false);
    }
  };

  const handleMachineTypeChange = (event) => {
    const selectedTypeId = event.target.value;
    setNewRecord(prev => ({
      ...prev,
      machine_type: selectedTypeId
    }));
    if (validationErrors.machine_type) {
      setValidationErrors(prev => ({
        ...prev,
        machine_type: undefined
      }));
    }
    };

    const columns = [
    { field: "display_op_no", headerName: "Operation No.", flex: 1 },
        { field: "operation", headerName: "Operation", flex: 1, editable: true },
        { field: "description", headerName: "Description", flex: 1, editable: true },
        { field: "machine_type", headerName: "Machine Type", flex: 1, editable: true },
    { 
      field: "cycle_time_sec", 
      headerName: "Cycle Time (sec)", 
      flex: 1, 
      editable: true,
      type: 'number'
    },
    { 
      field: "yield_percentage", 
      headerName: "Yield %", 
      flex: 1, 
      editable: true,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        return `${params.value}%`;
      }
    },
    { 
      field: "operator_count", 
      headerName: "Operator Count", 
      flex: 1, 
      editable: true,
      type: 'number'
    }
  ];

  // When rendering DataGrid, map data to add display_op_no
  const displayData = data.map((row, idx) => ({ ...row, display_op_no: idx + 1 }));

    return (
        <Box m="20px">
      <Header title="PROCESS FLOW MATRIX" subtitle="Manage Process Flow Records" />

      <Box display="flex" justifyContent="space-between" mb="10px">
        <Box flex={1}>
          <ItemMasterDropdown onSelect={setSelectedItemMaster} fullWidth />
        </Box>
      </Box>

      {!selectedItemMaster && (
        <Typography color="error" mb={2}>
          Please select an Item Master to view and manage records
        </Typography>
      )}

            <Box display="flex" justifyContent="space-between" mb="10px">
        <Box>
          <Button 
            variant="contained" 
            color="primary" 
            onClick={() => setOpenCreateDialog(true)}
            disabled={!selectedItemMaster}
            sx={{ mr: 1 }}
          >
            Create New
          </Button>
        </Box>
        <Button 
          variant="contained" 
          color="error" 
          onClick={handleDelete}
          disabled={selectedRows.length === 0}
        >
          Delete Selected ({selectedRows.length})
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
        }}
      >
        {isLoading ? (
          <Box display="flex" justifyContent="center" alignItems="center" height="100%">
            <CircularProgress />
          </Box>
        ) : (
                <DataGrid
            rows={displayData}
                    columns={columns}
            getRowId={(row) => row.id}
            checkboxSelection
            onSelectionModelChange={(ids) => setSelectedRows(ids)}
                    components={{ Toolbar: GridToolbar }}
            disableSelectionOnClick
            pageSize={10}
            rowsPerPageOptions={[10, 25, 50]}
            pagination
                />
        )}
            </Box>

      <ToastContainer 
        position="bottom-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        pauseOnHover
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={openDeleteDialog} onClose={() => setOpenDeleteDialog(false)}>
        <DialogTitle>Confirm Deletion</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete {selectedRows.length} selected record(s)?
            This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDeleteDialog(false)}>Cancel</Button>
          <Button onClick={handleConfirmDelete} color="error" disabled={isLoading}>
            {isLoading ? <CircularProgress size={24} /> : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Create New Record Dialog */}
      <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)} maxWidth="md" fullWidth>
        <DialogTitle>Create New Process Flow Record</DialogTitle>
                <DialogContent>
          <Box display="grid" gap="20px" gridTemplateColumns="repeat(2, 1fr)" sx={{ mt: 2 }}>
            <TextField
              label="Operation"
              value={newRecord.operation}
              onChange={(e) => handleInputChange('operation', e.target.value)}
              error={!!validationErrors.operation}
              helperText={validationErrors.operation}
              fullWidth
              required
            />
                        <TextField
              label="Description"
              value={newRecord.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              error={!!validationErrors.description}
              helperText={validationErrors.description}
                            fullWidth
              multiline
              rows={2}
            />
            <FormControl fullWidth required error={!!validationErrors.machine_type}>
              <InputLabel>Machine Type</InputLabel>
              <Select
                value={newRecord.machine_type}
                onChange={handleMachineTypeChange}
                label="Machine Type"
              >
                {machineTypes.map((type) => (
                  <MenuItem key={type.id} value={type.id}>
                    {type.name}
                  </MenuItem>
                ))}
              </Select>
              {validationErrors.machine_type && (
                <FormHelperText>{validationErrors.machine_type}</FormHelperText>
              )}
            </FormControl>
            <TextField
              label="Cycle Time (seconds)"
              value={newRecord.cycle_time_sec}
              onChange={(e) => handleInputChange('cycle_time_sec', e.target.value)}
              error={!!validationErrors.cycle_time_sec}
              helperText={validationErrors.cycle_time_sec}
              fullWidth
              required
              type="number"
            />
            <TextField
              label="Yield Percentage"
              value={newRecord.yield_percentage}
              onChange={(e) => handleInputChange('yield_percentage', e.target.value)}
              error={!!validationErrors.yield_percentage}
              helperText={validationErrors.yield_percentage}
              fullWidth
              type="number"
              InputProps={{ inputProps: { min: 0, max: 100 } }}
            />
            <TextField
              label="Operator Count"
              value={newRecord.operator_count}
              onChange={(e) => handleInputChange('operator_count', e.target.value)}
              error={!!validationErrors.operator_count}
              helperText={validationErrors.operator_count}
              fullWidth
              type="number"
              InputProps={{ inputProps: { min: 0 } }}
            />
          </Box>
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
          <Button
            onClick={handleCreate}
            variant="contained"
            disabled={isLoading}
          >
            {isLoading ? <CircularProgress size={24} /> : "Create"}
          </Button>
                </DialogActions>
            </Dialog>
        </Box>
    );
};

export default ProcessFlow;

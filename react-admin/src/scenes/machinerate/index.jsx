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
import CountryDropdown from "../countriesdd/index.jsx";
import BulkUploadDialog from './BulkUploadDialog';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

// Predefined values for dropdowns
const predefinedValues = {
  purchase_dollar: [5000, 10000, 15000, 20000, 25000],
  res_value: [5, 10, 15, 20, 25],
  useful_life: [5, 7, 10, 12, 15],
  utilization: [60, 70, 80, 90, 95],
  maintenance: [2, 3, 4, 5, 6],
  power_kw_hr: [5, 10, 15, 20, 25],
  power_spec: [70, 75, 80, 85, 90],
  area_m2: [10, 20, 30, 40, 50],
  water_m3_hr: [1, 2, 3, 4, 5],
  consumables: [100, 200, 300, 400, 500]
};

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

const MachineRate = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const [data, setData] = useState([]);
  const [selectedCountry, setSelectedCountry] = useState("");
  const [selectedRows, setSelectedRows] = useState([]);
  const [openDeleteDialog, setOpenDeleteDialog] = useState(false);
  const [openCreateDialog, setOpenCreateDialog] = useState(false);
  const [selectedItemMaster, setSelectedItemMaster] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});
  const [openBulkUpload, setOpenBulkUpload] = useState(false);

  const [machineTypes, setMachineTypes] = useState([]);
  const [makes, setMakes] = useState([]);
  const [modelSizes, setModelSizes] = useState([]);
  
  // Modified newRecord state to include custom value fields
  const [newRecord, setNewRecord] = useState({
    machine_type: "",
    make: "",
    machine_type_name: "",
    make_name: "",
    model_size: "",
    purchase_dollar: "",
    purchase_dollar_custom: "",
    res_value: "",
    res_value_custom: "",
    useful_life: "",
    useful_life_custom: "",
    utilization: "",
    utilization_custom: "",
    maintenance: "",
    maintenance_custom: "",
    power_kw_hr: "",
    power_kw_hr_custom: "",
    power_spec: "",
    power_spec_custom: "",
    area_m2: "",
    area_m2_custom: "",
    water_m3_hr: "",
    water_m3_hr_custom: "",
    consumables: "",
    consumables_custom: ""
  });

  // Add validation constraints
  const validationConstraints = {
    purchase_dollar: { min: 0, max: 1000000 },
    res_value: { min: 0, max: 100 },
    useful_life: { min: 1, max: 50 },
    utilization: { min: 0, max: 100 },
    maintenance: { min: 0, max: 100 },
    power_kw_hr: { min: 0, max: 1000 },
    power_spec: { min: 0, max: 100 },
    area_m2: { min: 0, max: 10000 },
    water_m3_hr: { min: 0, max: 1000 },
    consumables: { min: 0, max: 1000000 }
  };

  // Load machine types and makes only once when component mounts
  useEffect(() => {
    fetchMachineTypes();
    fetchMakes();
    axios.get(`${API_BASE_URL}/fetch-model-sizes`)
      .then(res => setModelSizes(res.data))
      .catch(() => {});
  }, []);
  
  // Fetch data when filters change
  useEffect(() => {
    if (selectedItemMaster && selectedCountry) {
      fetchMachineRateData();
    }
  }, [selectedItemMaster, selectedCountry]);

  const fetchMachineTypes = async () => {
    setIsLoading(true);
    try {
      const response = await getAuthAxios().get(`/fetch-machine-types`);
      setMachineTypes(response.data);
    } catch (error) {
      toast.error("Error fetching machine types: " + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMakes = async () => {
    setIsLoading(true);
    try {
      const response = await getAuthAxios().get(`/fetch-makes`);
      setMakes(response.data);
    } catch (error) {
      toast.error("Error fetching makes: " + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMachineRateData = async () => {
    if (!selectedItemMaster || !selectedCountry) return;
    
    setIsLoading(true);
    try {
      const response = await getAuthAxios().get(`/machine-rate-data?item_master_id=${selectedItemMaster}&country=${selectedCountry}`);
      // The backend now returns all calculated values, so we can use them directly
      setData(response.data);
    } catch (error) {
      toast.error("Error fetching data: " + (error.response?.data?.message || error.message));
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (selectedRows.length === 0) {
      toast.warn("No records selected for deletion");
      return;
    }
    
    setIsLoading(true);
    try {
      const response = await getAuthAxios().post(`/delete-machine-rate`, { ids: selectedRows });
    
      // Update the UI immediately
      setData(prevData => prevData.filter(row => !selectedRows.includes(row.id)));
      
      // Show success message
      toast.success(response.data.message || `${selectedRows.length} record(s) deleted successfully!`);
      
      // Reset selection and close dialog
      setSelectedRows([]);
      setOpenDeleteDialog(false);
      
      // Optionally refresh data to ensure consistency
      await fetchMachineRateData();
      
    } catch (error) {
      console.error("Delete error:", error);
      const errorMessage = error.response?.data?.detail || "Error deleting records";
      toast.error(errorMessage);
      
      // Refresh data to ensure UI consistency
      await fetchMachineRateData();
    } finally {
      setIsLoading(false);
    }
  };

  const handleEditCellCommit = async (params) => {
    const { id, field, value } = params;
    
    // Prevent editing calculated fields
    const calculatedFields = ["depreciation", "maintenance_1", "space", "power", "water", "total_dollar_hr"];
    if (calculatedFields.includes(field)) {
      toast.warn("This field is calculated automatically and cannot be edited directly.");
      return;
    }
    
    // Validate numeric fields
    if (["purchase_dollar", "res_value", "useful_life", "utilization", 
         "maintenance", "power_kw_hr", "power_spec", "area_m2", "water_m3_hr"].includes(field)) {
      const numValue = parseFloat(value);
      if (isNaN(numValue) || numValue < 0) {
        toast.error(`${field.replace(/_/g, " ")} must be a positive number`);
        fetchMachineRateData(); // Refresh to revert invalid change
        return;
      }
    }
    
    setIsLoading(true);
    try {
      await getAuthAxios().put(`/update-machine-rate/${id}`, {
        field: String(field),
        value: String(value),
        item_master_id: selectedItemMaster,
        country: selectedCountry
      });
      
      // Refresh the data to get updated calculations from backend
      fetchMachineRateData();
      toast.success("Record updated successfully!");
    } catch (error) {
      toast.error("Error updating record: " + (error.response?.data?.message || error.message));
      fetchMachineRateData(); // Refresh to ensure data consistency
    } finally {
      setIsLoading(false);
    }
  };

  // Modified handleInputChange function
  const handleInputChange = (field, value) => {
    const isCustomField = field.endsWith('_custom');
    const baseField = isCustomField ? field.replace('_custom', '') : field;
    
    // Validate numeric input for custom fields
    if (isCustomField) {
      const numValue = parseFloat(value);
      const constraints = validationConstraints[baseField];
      
      if (constraints) {
        if (isNaN(numValue)) {
          setValidationErrors(prev => ({
            ...prev,
            [baseField]: `Please enter a valid number`
          }));
          return;
        }
        
        if (numValue < constraints.min || numValue > constraints.max) {
          setValidationErrors(prev => ({
            ...prev,
            [baseField]: `Value must be between ${constraints.min} and ${constraints.max}`
          }));
          return;
        }
      }
    }

    setNewRecord(prev => {
      const updates = {};
      
      if (isCustomField) {
        // When changing custom input, update custom field and keep dropdown empty
        updates[field] = value;
        updates[baseField] = '';
      } else {
        // When changing dropdown, update main field and clear custom
        updates[field] = value;
        if (value !== '') {
          updates[`${field}_custom`] = '';
        }
      }

      return { ...prev, ...updates };
    });
    
    // Clear validation error
    setValidationErrors(prev => ({
      ...prev,
      [baseField]: undefined
    }));
  };

  // Modified validateForm function
  const validateForm = () => {
    const errors = {};
    const requiredFields = ["machine_type", "make", "model_size", "purchase_dollar", 
                           "res_value", "useful_life", "utilization"];
    
    requiredFields.forEach(field => {
      const value = newRecord[field] || newRecord[`${field}_custom`];
      if (!value && value !== 0) {
        errors[field] = `${field.replace(/_/g, " ")} is required`;
      }
    });
    
    // Validate numeric fields against constraints
    Object.entries(validationConstraints).forEach(([field, constraints]) => {
      const value = newRecord[field] || newRecord[`${field}_custom`];
      if (value) {
        const numValue = parseFloat(value);
        if (isNaN(numValue)) {
          errors[field] = `Please enter a valid number`;
        } else if (numValue < constraints.min || numValue > constraints.max) {
          errors[field] = `Value must be between ${constraints.min} and ${constraints.max}`;
        }
      }
    });
    
    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Modified prepareSubmitData function
  const prepareSubmitData = () => {
    const submitData = {};
    const numericFields = [
      'purchase_dollar', 'res_value', 'useful_life', 'utilization',
      'maintenance', 'power_kw_hr', 'power_spec', 'area_m2',
      'water_m3_hr', 'consumables'
    ];

    for (const field of numericFields) {
      // Use custom value if it exists, otherwise use the dropdown value
      const customValue = newRecord[`${field}_custom`];
      const dropdownValue = newRecord[field];
      
      submitData[field] = customValue !== '' ? 
        parseFloat(customValue) : 
        (dropdownValue !== '' ? parseFloat(dropdownValue) : 0);
    }

    return {
      ...submitData,
      machine_type: newRecord.machine_type,
      make: newRecord.make,
      model_size: newRecord.model_size
    };
  };

  const handleCreate = async () => {
    setIsLoading(true);
    const errors = validateForm();
    
    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      setIsLoading(false);
      return;
    }

    try {
      const submitData = prepareSubmitData();
      const response = await getAuthAxios().post(
        `/create-machine-rate?item_master_id=${selectedItemMaster}&country=${selectedCountry}`, 
        submitData
      );
      
      toast.success("Machine rate created successfully!");
      setOpenCreateDialog(false);
      fetchMachineRateData();
      resetNewRecordForm();
    } catch (error) {
      console.error("Error creating machine rate:", error);
      toast.error(error.response?.data?.detail || "Error creating machine rate");
    } finally {
      setIsLoading(false);
    }
  };

  const resetNewRecordForm = () => {
    setNewRecord({
      machine_type: "",
      make: "",
      machine_type_name: "",
      make_name: "",
      model_size: "",
      purchase_dollar: "",
      purchase_dollar_custom: "",
      res_value: "",
      res_value_custom: "",
      useful_life: "",
      useful_life_custom: "",
      utilization: "",
      utilization_custom: "",
      maintenance: "",
      maintenance_custom: "",
      power_kw_hr: "",
      power_kw_hr_custom: "",
      power_spec: "",
      power_spec_custom: "",
      area_m2: "",
      area_m2_custom: "",
      water_m3_hr: "",
      water_m3_hr_custom: "",
      consumables: "",
      consumables_custom: ""
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

  // Special handler for machine type selection that updates both ID and name
  const handleMachineTypeChange = (event) => {
    const selectedTypeId = event.target.value;
    const selectedType = machineTypes.find(type => type.id === selectedTypeId);
    
    if (selectedType) {
      setNewRecord(prev => ({
        ...prev,
        machine_type: selectedTypeId, // Store ID with field name the backend expects
        machine_type_name: selectedType.name // Store name for UI display
      }));
      
      // Clear validation error
      if (validationErrors.machine_type) {
        setValidationErrors(prev => ({
          ...prev,
          machine_type: undefined
        }));
      }
    }
  };

  // Special handler for make selection that updates both ID and name
  const handleMakeChange = (event) => {
    const selectedMakeId = event.target.value;
    const selectedMake = makes.find(make => make.id === selectedMakeId);
    
    if (selectedMake) {
      setNewRecord(prev => ({
        ...prev,
        make: selectedMakeId, // Store ID with field name the backend expects
        make_name: selectedMake.make // Store name for UI display
      }));
      
      // Clear validation error
      if (validationErrors.make) {
        setValidationErrors(prev => ({
          ...prev,
          make: undefined
        }));
      }
    }
  };

  const handleBulkUploadSuccess = (data) => {
    toast.success('Machine rates uploaded successfully!');
    fetchMachineRateData(); // Refresh the data
  };

  // Columns definition - we display names but work with IDs behind the scenes
  const columns = [
    { 
      field: "machine_type", 
      headerName: "Machine Type", 
      flex: 1, 
      editable: true,
    },
    { 
      field: "make", 
      headerName: "Make", 
      flex: 1, 
      editable: true
    },
    { field: "model_size", headerName: "Model/Size", flex: 1, editable: true },
    { 
      field: "purchase_dollar", 
      headerName: "Purchase Price", 
      flex: 1, 
      editable: true,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        const currencySymbol = params.row?.currency_symbol || '$';
        return `${currencySymbol} ${params.value.toFixed(3)}`;
      }
    },
    { 
      field: "res_value", 
      headerName: "Residual Value", 
      flex: 1, 
      editable: true,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        return `${Math.round(params.value)}%`;
      }
    },
    { 
      field: "useful_life", 
      headerName: "Useful Life", 
      flex: 1, 
      editable: true,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        return params.value.toFixed(3);
      }
    },
    { 
      field: "utilization", 
      headerName: "Utilization", 
      flex: 1, 
      editable: true,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        return `${Math.round(params.value)}%`;
      }
    },
    { 
      field: "maintenance", 
      headerName: "Maintenance", 
      flex: 1, 
      editable: true,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        return `${Math.round(params.value)}%`;
      }
    },
    { 
      field: "power_kw_hr", 
      headerName: "Power KW/hr", 
      flex: 1, 
      editable: true,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        return params.value.toFixed(3);
      }
    },
    { 
      field: "power_spec", 
      headerName: "Power Spec", 
      flex: 1, 
      editable: true,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        return `${Math.round(params.value)}%`;
      }
    },
    { 
      field: "area_m2", 
      headerName: "Area m²", 
      flex: 1, 
      editable: true,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        return params.value.toFixed(3);
      }
    },
    { 
      field: "water_m3_hr", 
      headerName: "Water m³/hr", 
      flex: 1, 
      editable: true,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        return params.value.toFixed(3);
      }
    },
    { 
      field: "depreciation", 
      headerName: "Depreciation", 
      flex: 1, 
      editable: false,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        const currencySymbol = params.row?.currency_symbol || '$';
        return `${currencySymbol} ${params.value.toFixed(3)}/hr`;
      }
    },
    { 
      field: "maintenance_1", 
      headerName: "Maintenance", 
      flex: 1, 
      editable: false,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        const currencySymbol = params.row?.currency_symbol || '$';
        return `${currencySymbol} ${params.value.toFixed(3)}/hr`;
      }
    },
    { 
      field: "space", 
      headerName: "Space", 
      flex: 1, 
      editable: false,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        const currencySymbol = params.row?.currency_symbol || '$';
        return `${currencySymbol} ${params.value.toFixed(3)}/hr`;
      }
    },
    { 
      field: "power", 
      headerName: "Power", 
      flex: 1, 
      editable: false,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        const currencySymbol = params.row?.currency_symbol || '$';
        return `${currencySymbol} ${params.value.toFixed(3)}/hr`;
      }
    },
    { 
      field: "water", 
      headerName: "Water", 
      flex: 1, 
      editable: false,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        const currencySymbol = params.row?.currency_symbol || '$';
        return `${currencySymbol} ${params.value.toFixed(3)}/hr`;
      }
    },
    { 
      field: "total_dollar_hr", 
      headerName: "Total", 
      flex: 1, 
      editable: false,
      type: 'number',
      valueFormatter: (params) => {
        if (params.value == null) return '';
        const currencySymbol = params.row?.currency_symbol || '$';
        return `${currencySymbol} ${params.value.toFixed(3)}/hr`;
      }
    }
  ];

  // Modified renderNumericInput function to include both dropdown and custom input
  const renderNumericInput = (field, label, isRequired = false) => {
    const constraints = validationConstraints[field] || {};
    return (
    <FormControl 
      fullWidth 
      margin="normal" 
      error={Boolean(validationErrors[field])}
    >
        <InputLabel>{label}{isRequired ? ' *' : ''}</InputLabel>
        <Select
        value={newRecord[field]}
          onChange={(e) => handleInputChange(field, e.target.value)}
          label={label}
          error={Boolean(validationErrors[field])}
        >
          <MenuItem value="">
            <em>Custom Value</em>
          </MenuItem>
          {predefinedValues[field]?.map((value) => (
            <MenuItem key={value} value={value}>{value}</MenuItem>
          ))}
        </Select>
        {newRecord[field] === "" && (
          <Box sx={{ mt: 1 }}>
            <TextField
        size="small"
              value={newRecord[`${field}_custom`] || ''}
              onChange={(e) => handleInputChange(`${field}_custom`, e.target.value)}
              placeholder={`Enter ${label} (${constraints.min}-${constraints.max})`}
              type="number"
              InputProps={{ 
                inputProps: { 
                  min: constraints.min,
                  max: constraints.max,
                  step: "0.01"
                } 
              }}
              fullWidth
        error={Boolean(validationErrors[field])}
      />
          </Box>
        )}
      {validationErrors[field] && (
          <FormHelperText error>{validationErrors[field]}</FormHelperText>
      )}
    </FormControl>
  );
  };

  return (
    <Box m="20px">
      <Header title="MACHINE RATE DATA" subtitle="Detailed Machine Rate Calculation Records" />

      <Box display="flex" justifyContent="space-between" mb="10px" gap="10px">
        <Box flex={1}>
          <ItemMasterDropdown onSelect={setSelectedItemMaster} fullWidth />
        </Box>
        <Box flex={1}>
          <CountryDropdown selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry} />
        </Box>
      </Box>

      {(!selectedItemMaster || !selectedCountry) && (
        <Typography color="error" mb={2}>
          Please select both Item Master and Country to view and manage records
        </Typography>
      )}

      <Box display="flex" justifyContent="space-between" mb="10px">
        <Box>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={() => setOpenCreateDialog(true)}
          disabled={!selectedItemMaster || !selectedCountry}
            sx={{ mr: 1 }}
        >
          Create New
        </Button>
          <Button 
            variant="contained" 
            color="secondary" 
            onClick={() => setOpenBulkUpload(true)}
            disabled={!selectedItemMaster || !selectedCountry}
          >
            Bulk Upload
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
            rows={data}
            columns={columns}
            getRowId={(row) => row.id}
            checkboxSelection
            onSelectionModelChange={(ids) => setSelectedRows(ids)}
            onCellEditCommit={handleEditCellCommit}
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
        <DialogTitle>Create New Machine Rate Record</DialogTitle>
        <DialogContent>
          <Box display="grid" gap="20px" gridTemplateColumns="repeat(2, 1fr)" sx={{ mt: 2 }}>
            {/* Machine Type Dropdown */}
            <FormControl fullWidth error={!!validationErrors.machine_type}>
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
                <FormHelperText error>{validationErrors.machine_type}</FormHelperText>
                )}
              </FormControl>

            {/* Make Dropdown */}
            <FormControl fullWidth error={!!validationErrors.make}>
              <InputLabel>Make</InputLabel>
                <Select
                  value={newRecord.make}
                  onChange={handleMakeChange}
                label="Make"
                >
                  {makes.map((make) => (
                  <MenuItem key={make.id} value={make.id}>
                    {make.make}
                  </MenuItem>
                  ))}
                </Select>
                {validationErrors.make && (
                <FormHelperText error>{validationErrors.make}</FormHelperText>
                )}
              </FormControl>

            {/* Model/Size Dropdown */}
            <FormControl fullWidth required error={!!validationErrors.model_size} sx={{ mb: 2 }}>
              <InputLabel>Model/Size</InputLabel>
              <Select
                  value={newRecord.model_size}
                onChange={e => handleInputChange('model_size', e.target.value)}
                label="Model/Size"
              >
                {modelSizes.map((ms) => (
                  <MenuItem key={ms.id} value={ms.model_name}>{ms.model_name}</MenuItem>
                ))}
              </Select>
                {validationErrors.model_size && (
                  <FormHelperText>{validationErrors.model_size}</FormHelperText>
                )}
              </FormControl>

            {/* Numeric inputs with dropdowns */}
            {renderNumericInput('purchase_dollar', 'Purchase $', true)}
            {renderNumericInput('res_value', 'Residual Value %', true)}
            {renderNumericInput('useful_life', 'Useful Life (years)', true)}
            {renderNumericInput('utilization', 'Utilization %', true)}
            {renderNumericInput('maintenance', 'Maintenance %')}
            {renderNumericInput('power_kw_hr', 'Power KW/hr')}
            {renderNumericInput('power_spec', 'Power Spec %')}
            {renderNumericInput('area_m2', 'Area m²')}
            {renderNumericInput('water_m3_hr', 'Water m³/hr')}
            {renderNumericInput('consumables', 'Consumables')}
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

export default MachineRate;
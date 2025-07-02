import React, { useEffect, useState } from "react";
import { Box, Button, Typography, Dialog, DialogTitle, DialogContent, DialogActions, TextField, MenuItem, Select, FormControl, InputLabel } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import { tokens } from "../../theme";
import Header from "../../components/Header";
import axios from "axios";
import { useTheme } from "@mui/material";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import ItemMasterDropdown from "../itmasdd.jsx";
import CountryDropdown from "../countriesdd/index.jsx";
import DeleteIcon from '@mui/icons-material/Delete';
import { Table, TableBody, TableCell, TableContainer, TableRow, Paper } from "@mui/material";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

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

// Additional Cost Columns
const additionalCostColumns = [
    { field: "category", headerName: "Category", flex: 1 },
    { field: "amount", headerName: "Amount", flex: 1, 
        renderCell: (params) => (
            <Typography>
                {params.value.toLocaleString('en-US', {
                    style: 'currency',
                    currency: 'USD'
                })}
            </Typography>
        )
    }
];

const CostAggregate = () => {
    const theme = useTheme();
    const colors = tokens(theme.palette.mode);
    const [data, setData] = useState([]);
    const [selectedItemMaster, setSelectedItemMaster] = useState(null);
    const [selectedCountry, setSelectedCountry] = useState("");
    const [processFlows, setProcessFlows] = useState([]);
    const [selectedProcessFlow, setSelectedProcessFlow] = useState("");
    const [openCreateDialog, setOpenCreateDialog] = useState(false);
    const [createForm, setCreateForm] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const [selectedRows, setSelectedRows] = useState([]);
    const [machineTypes, setMachineTypes] = useState([]);
    const [finalCost, setFinalCost] = useState(null);
    const [finalCostLoading, setFinalCostLoading] = useState(false);
    const [showAdditionalCosts, setShowAdditionalCosts] = useState(false);
    const [additionalCosts, setAdditionalCosts] = useState({
        materialHandling: 0,
        overheads: 0,
        profit: 0,
        totalCost: 0
    });

    useEffect(() => {
        if (selectedItemMaster) {
            axios.get(`${API_BASE_URL}/fetch-process-flows?item_master_id=${selectedItemMaster}`)
                .then(res => setProcessFlows(res.data))
                .catch(() => setProcessFlows([]));
        } else {
            setProcessFlows([]);
        }
        setSelectedProcessFlow("");
    }, [selectedItemMaster]);

    useEffect(() => {
        if (selectedItemMaster && selectedCountry) {
            fetchCostAggregate(selectedItemMaster);
        }
    }, [selectedItemMaster, selectedCountry]);

    // Calculate Additional Costs
    const calculateAdditionalCosts = (costAggregates) => {
        // Use only the last process flow's total_cost
        const lastTotalCost = costAggregates.length > 0
            ? parseFloat(costAggregates[costAggregates.length - 1].total_cost) || 0
            : 0;
        const materialHandling = lastTotalCost * 0.02; // 2%
        const overheads = lastTotalCost * 0.075; // 7.5%
        const profit = lastTotalCost * 0.075; // 7.5%
        const totalCost = lastTotalCost + materialHandling + overheads + profit;
        setAdditionalCosts({
            materialHandling,
            overheads,
            profit,
            totalCost
        });
    };

    // Fetch cost aggregates for table (with real DB id)
    const fetchCostAggregate = (itemMasterId) => {
        axios.get(`${API_BASE_URL}/fetch-cost-aggregates?item_master_id=${itemMasterId}`)
            .then(response => {
                const dataWithNames = response.data.map((row, idx) => ({
                    ...row,
                    machine_type_name:
                        row.machine_type_name ||
                        (machineTypes.find(mt => mt.id === row.machine_type)?.name) ||
                        row.machine_type,
                    row_op_no: idx + 1
                }));
                setData(dataWithNames);
                calculateAdditionalCosts(dataWithNames);
                setShowAdditionalCosts(false); // Hide table when data changes
            })
            .catch(error => console.error("Error fetching Cost Aggregate data:", error));
    };

    const handleEditCellCommit = async (params) => {
        const { id, field, value } = params;
        const updatedRows = data.map(row =>
            row.op_no === id ? { ...row, [field]: value } : row
        );
        setData(updatedRows);
    };

    // For autofill in create dialog, use processFlows and machine rate data directly
    const handleProcessFlowSelect = (value) => {
        setSelectedProcessFlow(value);
        if (!value) return;
        const [operation, machine_type] = value.split('|||');
        const pf = processFlows.find(
            p => p.operation === operation && String(p.machine_type) === machine_type
        );
        if (!pf) return;
        // Fetch machine rate and labor rate from machine rate and country endpoints
        let machineRate = 0;
        let laborRate = 0;
        (async () => {
            try {
                const machineRateRes = await axios.get(`${API_BASE_URL}/machine-rate-data?item_master_id=${selectedItemMaster}&country=${selectedCountry}`);
                const machineTypeName = pf.machine_type_name || (machineTypes.find(mt => mt.id === pf.machine_type)?.name);
                const machineRateRow = machineRateRes.data.find(r => r.machine_type === machineTypeName);
                if (machineRateRow) {
                    machineRate = machineRateRow.total_dollar_hr || machineRateRow.machine_rate || 0;
                }
                const countryRes = await axios.get(`${API_BASE_URL}/fetch-countries`);
                const countryObj = countryRes.data.find(c => c.name === selectedCountry);
                if (countryObj) {
                    laborRate = countryObj.labor_rate;
                }
            } catch {}
            setCreateForm({
                ...pf,
                machine_rate: machineRate,
                labor_rate: laborRate,
                input_material_cost: "",
                consumables_cost: ""
            });
        })();
    };

    const handleCreateInputChange = (field, value) => {
        setCreateForm(prev => ({ ...prev, [field]: value }));
    };

    const handleCreateSubmit = async () => {
        setIsLoading(true);
        try {
            await getAuthAxios().post(`/create-cost-aggregate`, {
                item_master_id: selectedItemMaster,
                operation: createForm.operation,
                machine_type: createForm.machine_type,
                machine_rate: createForm.machine_rate,
                labor_rate: createForm.labor_rate,
                input_material_cost: createForm.input_material_cost,
                consumables_cost: createForm.consumables_cost
            });
            toast.success("Cost aggregate created successfully!");
            setOpenCreateDialog(false);
            fetchCostAggregate(selectedItemMaster);
        } catch (error) {
            const backendMsg = error.response?.data?.detail || error.response?.data?.message || error.message;
            toast.error(backendMsg || "Failed to create cost aggregate.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleBulkDelete = async () => {
        if (selectedRows.length === 0) return;
        if (!window.confirm("Are you sure you want to delete the selected cost aggregates?")) return;
        setIsLoading(true);
        try {
            await getAuthAxios().post(`/delete-cost-aggregate`, { ids: selectedRows });
            toast.success("Selected cost aggregates deleted successfully!");
            fetchCostAggregate(selectedItemMaster);
            setSelectedRows([]);
        } catch (error) {
            const backendMsg = error.response?.data?.detail || error.response?.data?.message || error.message;
            toast.error(backendMsg);
        } finally {
            setIsLoading(false);
        }
    };

    // Fetch machine types on mount
    useEffect(() => {
        axios.get(`${API_BASE_URL}/fetch-machine-types`)
            .then(res => setMachineTypes(res.data))
            .catch(() => setMachineTypes([]));
    }, []);

    // Open create dialog and autofill fields
    const handleOpenCreateDialog = async () => {
        // Find process flow details
        console.log('selectedProcessFlow:', selectedProcessFlow);
        const [operation, machine_type] = selectedProcessFlow.split('|||');
        const pf = processFlows.find(p => p.operation === operation && String(p.machine_type) === machine_type);
        console.log('pf:', pf);
        if (!pf) return;
        // Dynamically determine next op_no
        const maxOpNo = processFlows.reduce((max, pf) => Math.max(max, pf.op_no || 0), 0);
        const nextOpNo = maxOpNo + 1;
        let machineTypeName = pf.machine_type_name;
        if (!machineTypeName) {
            const mt = machineTypes.find(mt => mt.id === pf.machine_type);
            machineTypeName = mt ? mt.name : pf.machine_type;
        }
        let machineRate = 0;
        let laborRate = 0;
        try {
            // Fetch all machine rates for the selected item master and country
            const machineRateRes = await axios.get(`${API_BASE_URL}/machine-rate-data?item_master_id=${selectedItemMaster}&country=${selectedCountry}`);
            // Find the machine rate for the process flow's machine type name
            const machineRateRow = machineRateRes.data.find(r => r.machine_type === machineTypeName);
            if (machineRateRow) {
                machineRate = machineRateRow.total_dollar_hr || machineRateRow.machine_rate || 0;
            }
            // Fetch labor rate from country table
            const countryRes = await axios.get(`${API_BASE_URL}/fetch-countries`);
            const countryObj = countryRes.data.find(c => c.name === selectedCountry);
            if (countryObj) {
                laborRate = countryObj.labor_rate;
            }
        } catch {}
        setCreateForm({
            ...pf,
            op_no: nextOpNo,
            machine_type_name: machineTypeName,
            machine_rate: machineRate,
            labor_rate: laborRate,
            input_material_cost: "",
            consumables_cost: ""
        });
        setOpenCreateDialog(true);
    };

    const handleCalculateFinalCost = async () => {
        if (!selectedItemMaster) return;
        setFinalCostLoading(true);
        try {
            const res = await axios.get(`${API_BASE_URL}/cost-aggregate/final-cost/${selectedItemMaster}`);
            setFinalCost(res.data);
        } catch (err) {
            toast.error("Failed to calculate final cost.");
            setFinalCost(null);
        } finally {
            setFinalCostLoading(false);
        }
    };

    // Additional Costs Data (recomputed on each render)
    const additionalCostsData = [
        { id: 1, category: "Material Handling (2%)", amount: additionalCosts.materialHandling },
        { id: 2, category: "Overheads (7.5%)", amount: additionalCosts.overheads },
        { id: 3, category: "Profit (7.5%)", amount: additionalCosts.profit },
        { id: 4, category: "Total Cost", amount: additionalCosts.totalCost }
    ];


    const columns = [
        { field: "row_op_no", headerName: "Op No", flex: 0.5 },
        { field: "operation", headerName: "Operation", flex: 1 },
        { field: "description", headerName: "Description", flex: 1 },
        { field: "machine_type_name", headerName: "Machine Type", flex: 1 },
        { 
            field: "cycle_time_sec", 
            headerName: "CT (sec)", 
            flex: 1,
            type: 'number',
            valueFormatter: (params) => params.value?.toFixed(2) || ''
        },
        { 
            field: "yield_percentage", 
            headerName: "Yield (%)", 
            flex: 1,
            type: 'number',
            valueFormatter: (params) => params.value?.toFixed(2) || ''
        },
        { 
            field: "operator_count", 
            headerName: "Operators", 
            flex: 1,
            type: 'number',
            valueFormatter: (params) => params.value?.toFixed(2) || ''
        },
        { 
            field: "machine_rate", 
            headerName: "Machine Rate ($/hr)", 
            flex: 1,
            type: 'number',
            valueFormatter: (params) => `$${params.value?.toFixed(2)}` || ''
        },
        { 
            field: "labor_rate", 
            headerName: "Labor Rate ($/hr)", 
            flex: 1,
            type: 'number',
            valueFormatter: (params) => `$${params.value?.toFixed(2)}` || ''
        },
        { 
            field: "input_material_cost", 
            headerName: "Input Material Cost ($)", 
            flex: 1, 
            editable: true,
            type: 'number',
            valueFormatter: (params) => `$${params.value?.toFixed(2)}` || ''
        },
        { 
            field: "consumables_cost", 
            headerName: "Consumables Cost ($)", 
            flex: 1, 
            editable: true,
            type: 'number',
            valueFormatter: (params) => `$${params.value?.toFixed(2)}` || ''
        },
        { 
            field: "total_labor_cost", 
            headerName: "Total Labor Cost ($)", 
            flex: 1,
            type: 'number',
            valueFormatter: (params) => `$${params.value?.toFixed(2)}` || ''
        },
        { 
            field: "total_machine_cost", 
            headerName: "Total Machine Cost ($)", 
            flex: 1,
            type: 'number',
            valueFormatter: (params) => `$${params.value?.toFixed(2)}` || ''
        },
        { 
            field: "total_operating_cost", 
            headerName: "Total Operating Cost ($)", 
            flex: 1,
            type: 'number',
            valueFormatter: (params) => `$${params.value?.toFixed(2)}` || ''
        },
        { 
            field: "cumulative_operating_cost", 
            headerName: "Cumulative Operating Cost ($)", 
            flex: 1,
            type: 'number',
            valueFormatter: (params) => `$${params.value?.toFixed(2)}` || ''
        },
        { 
            field: "yield_loss_cost", 
            headerName: "Yield Loss Cost ($)", 
            flex: 1,
            type: 'number',
            valueFormatter: (params) => `$${params.value?.toFixed(2)}` || ''
        },
        { 
            field: "total_cost", 
            headerName: "Total Cost ($)", 
            flex: 1,
            type: 'number',
            valueFormatter: (params) => `$${params.value?.toFixed(2)}` || ''
        }
    ];


    return (
        <Box m="20px">
            <Header title="COST AGGREGATE" subtitle="Calculated cost breakdowns" />
            <Box display="flex" justifyContent="space-between" mb="10px">
                <Box flex={1} mr={2}>
                    <ItemMasterDropdown onSelect={setSelectedItemMaster} fullWidth />
                </Box>
                <Box flex={1} mr={2}>
                    <CountryDropdown selectedCountry={selectedCountry} setSelectedCountry={setSelectedCountry} />
                </Box>
                <Box flex={1}>
                    <FormControl fullWidth>
                        <InputLabel>Process Flow</InputLabel>
                        <Select
                            value={selectedProcessFlow}
                            label="Process Flow"
                            onChange={e => handleProcessFlowSelect(e.target.value)}
                            disabled={!selectedItemMaster || processFlows.length === 0}
                        >
                            {processFlows.map((pf) => (
                                <MenuItem
                                    key={`${pf.operation}-${pf.machine_type}`}
                                    value={`${pf.operation}|||${pf.machine_type}`}
                                >
                                    {`${pf.operation} - ${pf.machine_type_name || pf.machine_type}`}
                                </MenuItem>
                            ))}
                        </Select>
                    </FormControl>
                </Box>
                <Box>
                    <Button
                        variant="contained"
                        color="primary"
                        onClick={handleOpenCreateDialog}
                        disabled={!selectedProcessFlow}
                    >
                        Create
                    </Button>
                </Box>
            </Box>
            {(!selectedItemMaster || !selectedCountry) && (
                <Typography color="error" mb={2}>
                    Please select an Item Master and enter a Country to view and manage cost aggregates.
                </Typography>
            )}

<>
                <Button
                    variant="contained"
                    color="success"
                    onClick={() => setShowAdditionalCosts(true)}
                    sx={{ mt: 2 }}
                >
                    CALCULATE FINAL COST
                </Button>
                {showAdditionalCosts && (
                    <Box sx={{ mt: 4 }}>
                        <Typography variant="h6" sx={{ mb: 2 }}>
                            Additional Costs
                        </Typography>
                        <Box sx={{ height: 300, width: "100%" }}>
                            <DataGrid
                                rows={additionalCostsData}
                                columns={additionalCostColumns}
                                pageSize={5}
                                rowsPerPageOptions={[5]}
                                disableSelectionOnClick
                                hideFooterSelectedRowCount
                            />
                        </Box>
                    </Box>
                )}
            </>
            
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
                <Box mb={2}>
                    <Button
                        variant="contained"
                        color="error"
                        startIcon={<DeleteIcon />}
                        onClick={handleBulkDelete}
                        disabled={selectedRows.length === 0 || isLoading}
                    >
                        Delete Selected
                    </Button>
                </Box>
                <DataGrid
                    rows={data}
                    columns={columns}
                    getRowId={(row) => row.id || row.op_no || row.operation}
                    onCellEditCommit={handleEditCellCommit}
                    checkboxSelection
                    onSelectionModelChange={(ids) => setSelectedRows(ids)}
                    components={{ Toolbar: GridToolbar }}
                />
            </Box>

            
            <Dialog open={openCreateDialog} onClose={() => setOpenCreateDialog(false)}>
                <DialogTitle>Create Cost Aggregate</DialogTitle>
                <DialogContent>
                    <TextField label="Op No" value={createForm.op_no || ''} fullWidth margin="dense" disabled />
                    <TextField label="Operation" value={createForm.operation || ''} fullWidth margin="dense" disabled />
                    <TextField label="Machine Type" value={createForm.machine_type_name || ''} fullWidth margin="dense" disabled />
                    <TextField label="Description" value={createForm.description || ''} fullWidth margin="dense" disabled />
                    <TextField label="CT (sec)" value={createForm.cycle_time_sec || ''} fullWidth margin="dense" disabled />
                    <TextField label="Yield (%)" value={createForm.yield_percentage || ''} fullWidth margin="dense" disabled />
                    <TextField label="Operators" value={createForm.operator_count || ''} fullWidth margin="dense" disabled />
                    <TextField label="Machine Rate ($/hr)" value={createForm.machine_rate || ''} fullWidth margin="dense" disabled />
                    <TextField label="Labor Rate ($/hr)" value={createForm.labor_rate || ''} fullWidth margin="dense" disabled />
                    <TextField label="Input Material Cost ($)" value={createForm.input_material_cost || ''} fullWidth margin="dense" onChange={e => handleCreateInputChange('input_material_cost', e.target.value)} />
                    <TextField label="Consumables Cost ($)" value={createForm.consumables_cost || ''} fullWidth margin="dense" onChange={e => handleCreateInputChange('consumables_cost', e.target.value)} />
                </DialogContent>
                <DialogActions>
                    <Button onClick={() => setOpenCreateDialog(false)}>Cancel</Button>
                    <Button onClick={handleCreateSubmit} color="primary" disabled={isLoading}>Submit</Button>
                </DialogActions>
            </Dialog>
            <ToastContainer />
        </Box>
    );
};

export default CostAggregate;

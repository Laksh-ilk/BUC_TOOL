import React, { useEffect, useState } from "react";
import { Box, Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField, Typography } from "@mui/material";
import { DataGrid, GridToolbar } from "@mui/x-data-grid";
import axios from "axios";
import Header from "../../components/Header";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

// Authenticated axios instance
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

const ModelSize = () => {
  const [data, setData] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editId, setEditId] = useState(null);
  const [modelName, setModelName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchModelSizes();
  }, []);

  const fetchModelSizes = () => {
    getAuthAxios().get(`/fetch-model-sizes`)
      .then(res => setData(res.data))
      .catch(() => toast.error("Failed to fetch model sizes"));
  };

  const handleOpenDialog = (id = null, name = "") => {
    setEditId(id);
    setModelName(name);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setEditId(null);
    setModelName("");
    setOpenDialog(false);
  };

  const handleSave = () => {
    setIsLoading(true);
    if (editId) {
      getAuthAxios().put(`/update-model-size/${editId}`, { model_name: modelName })
        .then(() => {
          toast.success("Model/Size updated");
          fetchModelSizes();
          handleCloseDialog();
        })
        .catch(() => toast.error("Failed to update model/size"))
        .finally(() => setIsLoading(false));
    } else {
      getAuthAxios().post(`/create-model-size`, { model_name: modelName })
        .then(() => {
          toast.success("Model/Size added");
          fetchModelSizes();
          handleCloseDialog();
        })
        .catch(() => toast.error("Failed to add model/size"))
        .finally(() => setIsLoading(false));
    }
  };

  const handleDelete = (id) => {
    if (!window.confirm("Are you sure you want to delete this model/size?")) return;
    setIsLoading(true);
    getAuthAxios().delete(`/delete-model-size/${id}`)
      .then(() => {
        toast.success("Model/Size deleted");
        fetchModelSizes();
      })
      .catch(() => toast.error("Failed to delete model/size"))
      .finally(() => setIsLoading(false));
  };

  const columns = [
    { field: "id", headerName: "ID", width: 90 },
    { field: "model_name", headerName: "Model/Size", flex: 1 },
    {
      field: "actions",
      headerName: "Actions",
      width: 180,
      renderCell: (params) => (
        <>
          <Button size="small" onClick={() => handleOpenDialog(params.row.id, params.row.model_name)}>Edit</Button>
          <Button size="small" color="error" onClick={() => handleDelete(params.row.id)}>Delete</Button>
        </>
      )
    }
  ];

  return (
    <Box m="20px">
      <Header title="MODEL/SIZE" subtitle="Manage Model/Size entries" />
      <Button variant="contained" color="primary" onClick={() => handleOpenDialog()} sx={{ mb: 2 }}>
        Add Model/Size
      </Button>
      <Box height="60vh">
        <DataGrid
          rows={data}
          columns={columns}
          getRowId={row => row.id}
          components={{ Toolbar: GridToolbar }}
          loading={isLoading}
        />
      </Box>
      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>{editId ? "Edit Model/Size" : "Add Model/Size"}</DialogTitle>
        <DialogContent>
          <TextField
            label="Model/Size Name"
            value={modelName}
            onChange={e => setModelName(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} disabled={isLoading || !modelName.trim()}>
            {editId ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
      <ToastContainer />
    </Box>
  );
};

export default ModelSize; 
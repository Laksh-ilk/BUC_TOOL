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

const MachineMake = () => {
  const [data, setData] = useState([]);
  const [openDialog, setOpenDialog] = useState(false);
  const [editId, setEditId] = useState(null);
  const [makeName, setMakeName] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    fetchMakes();
  }, []);

  const fetchMakes = () => {
    getAuthAxios().get(`/fetch-makes`)
      .then(res => setData(res.data))
      .catch(() => toast.error("Failed to fetch makes"));
  };

  const handleOpenDialog = (id = null, name = "") => {
    setEditId(id);
    setMakeName(name);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setEditId(null);
    setMakeName("");
    setOpenDialog(false);
  };

  const handleSave = () => {
    setIsLoading(true);
    if (editId) {
      getAuthAxios().put(`/update-make/${editId}`, { make: makeName })
        .then(() => {
          toast.success("Make updated");
          fetchMakes();
          handleCloseDialog();
        })
        .catch(() => toast.error("Failed to update make"))
        .finally(() => setIsLoading(false));
    } else {
      getAuthAxios().post(`/add-make`, { make: makeName })
        .then(() => {
          toast.success("Make added");
          fetchMakes();
          handleCloseDialog();
        })
        .catch(() => toast.error("Failed to add make"))
        .finally(() => setIsLoading(false));
    }
  };

  const handleDelete = (id) => {
    if (!window.confirm("Are you sure you want to delete this make?")) return;
    setIsLoading(true);
    getAuthAxios().delete(`/delete-make/${id}`)
      .then(() => {
        toast.success("Make deleted");
        fetchMakes();
      })
      .catch(() => toast.error("Failed to delete make"))
      .finally(() => setIsLoading(false));
  };

  const columns = [
    { field: "id", headerName: "ID", width: 90 },
    { field: "make", headerName: "Make", flex: 1 },
    {
      field: "actions",
      headerName: "Actions",
      width: 180,
      renderCell: (params) => (
        <>
          <Button size="small" onClick={() => handleOpenDialog(params.row.id, params.row.make)}>Edit</Button>
          <Button size="small" color="error" onClick={() => handleDelete(params.row.id)}>Delete</Button>
        </>
      )
    }
  ];

  return (
    <Box m="20px">
      <Header title="MACHINE MAKE" subtitle="Manage Machine Makes" />
      <Button variant="contained" color="primary" onClick={() => handleOpenDialog()} sx={{ mb: 2 }}>
        Add Make
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
        <DialogTitle>{editId ? "Edit Make" : "Add Make"}</DialogTitle>
        <DialogContent>
          <TextField
            label="Make Name"
            value={makeName}
            onChange={e => setMakeName(e.target.value)}
            fullWidth
            autoFocus
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button onClick={handleSave} disabled={isLoading || !makeName.trim()}>
            {editId ? "Update" : "Add"}
          </Button>
        </DialogActions>
      </Dialog>
      <ToastContainer />
    </Box>
  );
};

export default MachineMake;

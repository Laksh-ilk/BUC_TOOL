import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  CircularProgress,
  Alert,
  Stack
} from '@mui/material';
import axios from 'axios';
import * as XLSX from 'xlsx';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

const BulkUploadDialog = ({ open, onClose, itemMasterId, onSuccess }) => {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const handleFileChange = (event) => {
    const selectedFile = event.target.files[0];
    if (selectedFile) {
      // Validate file type
      if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
        setError('Please upload an Excel file (.xlsx or .xls)');
        return;
      }
      setFile(selectedFile);
      setError(null);
    }
  };

  const downloadTemplate = () => {
    // Create template data
    const templateData = [
      {
        'Machine Type': '',
        'Make': '',
        'Model/Size': '',
        'Purchase $': '',
        'Res Value': '',
        'Useful Life': '',
        'Utilization': '',
        'Maintenance': '',
        'Power (kW/hr)': '',
        'Power Spec': '',
        'Area m2': '',
        'Water m3/hr': '',
        'Consumables': ''
      }
    ];

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Add column widths
    const colWidths = [
      { wch: 15 }, // Machine Type
      { wch: 15 }, // Make
      { wch: 15 }, // Model/Size
      { wch: 12 }, // Purchase $
      { wch: 10 }, // Res Value
      { wch: 12 }, // Useful Life
      { wch: 12 }, // Utilization
      { wch: 12 }, // Maintenance
      { wch: 15 }, // Power (kW/hr)
      { wch: 12 }, // Power Spec
      { wch: 10 }, // Area m2
      { wch: 12 }, // Water m3/hr
      { wch: 12 }  // Consumables
    ];
    ws['!cols'] = colWidths;

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');

    // Save file
    XLSX.writeFile(wb, 'machine_rates_template.xlsx');
  };

  const handleUpload = async () => {
    if (!file || !itemMasterId) return;

    setIsUploading(true);
    setError(null);
    setSuccess(false);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('item_master_id', itemMasterId);

      // Get the token from localStorage
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error('Authentication token not found');
      }

      const response = await axios.post(`${API_BASE_URL}/bulk-upload-machine-rates`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
      });

      setSuccess(true);
      onSuccess(response.data);
      setTimeout(() => {
        onClose();
        setFile(null);
        setSuccess(false);
      }, 2000);
    } catch (error) {
      console.error('Upload error:', error);
      setError(error.response?.data?.message || 'Error uploading file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Bulk Upload Machine Rates</DialogTitle>
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          {success && (
            <Alert severity="success" sx={{ mb: 2 }}>
              File uploaded successfully!
            </Alert>
          )}
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Upload an Excel file containing machine rate data. The file should follow the template format.
          </Typography>
          <Stack spacing={2}>
            <Button
              variant="outlined"
              color="secondary"
              onClick={downloadTemplate}
              fullWidth
            >
              Download Template
            </Button>
            <Button
              variant="outlined"
              component="label"
              fullWidth
              disabled={isUploading}
            >
              {file ? file.name : 'Select Excel File'}
              <input
                type="file"
                hidden
                accept=".xlsx,.xls"
                onChange={handleFileChange}
              />
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
            Supported formats: .xlsx, .xls
          </Typography>
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isUploading}>
          Cancel
        </Button>
        <Button
          onClick={handleUpload}
          variant="contained"
          disabled={!file || isUploading}
        >
          {isUploading ? <CircularProgress size={24} /> : 'Upload'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default BulkUploadDialog; 
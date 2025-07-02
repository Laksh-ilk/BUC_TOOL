import { useState, useEffect } from "react";
import axios from "axios";
import { Select, MenuItem, FormControl, InputLabel } from "@mui/material";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

const ItemMasterDropdown = ({ onSelect }) => {
  const [itemMasters, setItemMasters] = useState([]);
  const [selectedItem, setSelectedItem] = useState("");

  useEffect(() => {
    axios.get(`${API_BASE_URL}/fetch-item-masters-dropdown`)
      .then((response) => {
        setItemMasters(response.data);
      })
      .catch((error) => {
        console.error("Error fetching item masters:", error);
      });
  }, []);

  const handleChange = (event) => {
    setSelectedItem(event.target.value);
    onSelect(event.target.value); // Pass selected Item Master ID to parent component
  };

  return (
    <FormControl fullWidth variant="outlined" size="small">
      <InputLabel id="item-master-label" shrink={!!selectedItem} sx={{ fontSize: '0.875rem' }}>Item Master</InputLabel>
      <Select 
            labelId="item-master-label"
            value={selectedItem}
            onChange={handleChange}
            label="Item Master"
            fullWidth
            size="small"
        >
        {itemMasters.map((item) => (
          <MenuItem key={item.id} value={item.id}>
            {item.label}
          </MenuItem>
        ))}
      </Select>
    </FormControl>
  );
};

export default ItemMasterDropdown;

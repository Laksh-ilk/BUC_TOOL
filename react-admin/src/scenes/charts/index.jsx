import React, { useState, useEffect } from "react";
import { Box, Typography, MenuItem, Select, FormControl, InputLabel } from "@mui/material";
import Header from "../../components/Header";
import BarChart from "../../components/BarChart";
import PieChart from "../../components/PieChart";
import LineChart from "../../components/LineChart";
import GeographyChart from "../../components/GeographyChart";
import axios from "axios";

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || "http://127.0.0.1:8000";

const Charts = () => {
  // State for item master and data type
  const [itemMasters, setItemMasters] = useState([]);
  const [selectedItemMaster, setSelectedItemMaster] = useState("");
  const [dataType, setDataType] = useState("costAggregateBar");
  const [barChartData, setBarChartData] = useState([]);
  const [pieChartData, setPieChartData] = useState([]);
  const [lineChartData, setLineChartData] = useState([]);
  const [geoChartData, setGeoChartData] = useState([]);

  // Fetch item masters on mount
  useEffect(() => {
    axios.get(`${API_BASE_URL}/fetch-item-masters-dropdown`)
      .then(res => setItemMasters(res.data))
      .catch(err => console.error("Error fetching item masters:", err));
  }, []);

  // Fetch and prepare data when item master or data type changes
  useEffect(() => {
    if (!selectedItemMaster) return;
    // Cost Aggregate Bar & Pie & Line & Geo
    if (["costAggregateBar", "costAggregatePie", "line", "geo"].includes(dataType)) {
      axios.get(`${API_BASE_URL}/fetch-cost-aggregates?item_master_id=${selectedItemMaster}`)
        .then(res => {
          const costAggregates = res.data;
          console.log('Fetched costAggregates:', costAggregates);
          if ((dataType === "costAggregateBar" || dataType === "costAggregatePie") && (!costAggregates[costAggregates.length - 1] || !costAggregates[costAggregates.length - 1].total_cost || costAggregates[costAggregates.length - 1].total_cost === 0)) {
            setBarChartData([]);
            setPieChartData([]);
            return;
          }
          const last = costAggregates[costAggregates.length - 1] || {};
          const lastTotalCost = parseFloat(last.total_cost) || 0;
          const materialHandling = lastTotalCost * 0.02;
          const overheads = lastTotalCost * 0.075;
          const profit = lastTotalCost * 0.075;
          const totalCost = lastTotalCost + materialHandling + overheads + profit;
          const breakdown = [
            { name: "Material Handling", value: materialHandling },
            { name: "Overheads", value: overheads },
            { name: "Profit", value: profit },
            { name: "Total Cost", value: totalCost }
          ];
          setBarChartData(breakdown);
          setPieChartData(breakdown);
          // Line
          if (dataType === "line") {
            const lineData = costAggregates.map(row => ({
              name: row.operation || row.op_no,
              value: parseFloat(row.cumulative_operating_cost) || 0
            }));
            setLineChartData(lineData);
          }
          // Geo (placeholder)
          if (dataType === "geo") {
            setGeoChartData([]);
          }
        })
        .catch(err => console.error("Error fetching cost aggregates:", err));
    }
  }, [selectedItemMaster, dataType]);

  return (
    <Box m="20px">
      <Header title="Charts" subtitle="Visualize cost and process data" />
      <Box mb={2} display="flex" gap={2}>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Item Master</InputLabel>
          <Select
            value={selectedItemMaster}
            label="Item Master"
            onChange={e => setSelectedItemMaster(e.target.value)}
          >
            {itemMasters.map(im => (
              <MenuItem key={im.id} value={im.id}>{im.label || im.name}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl sx={{ minWidth: 200 }}>
          <InputLabel>Chart Type</InputLabel>
          <Select
            value={dataType}
            label="Chart Type"
            onChange={e => setDataType(e.target.value)}
          >
            <MenuItem value="costAggregateBar">Cost Aggregate (Bar)</MenuItem>
            <MenuItem value="costAggregatePie">Cost Aggregate (Pie)</MenuItem>
            <MenuItem value="line">Cumulative Operating Cost (Line)</MenuItem>
            <MenuItem value="geo">Geography (Map)</MenuItem>
          </Select>
        </FormControl>
      </Box>
      {/* Bar Chart Section */}
      {dataType === "costAggregateBar" && barChartData.length > 0 && (
        <Box mt={4}>
          <Typography variant="h6" mb={2}>Cost Breakdown (Bar Chart)</Typography>
          <BarChart data={barChartData} />
        </Box>
      )}
      {/* Pie Chart Section */}
      {dataType === "costAggregatePie" && pieChartData.length > 0 && (
        <Box mt={4}>
          <Typography variant="h6" mb={2}>Cost Breakdown (Pie Chart)</Typography>
          <PieChart data={pieChartData} />
        </Box>
      )}
      {/* Line Chart Section */}
      {dataType === "line" && lineChartData.length > 0 && (
        <Box mt={4}>
          <Typography variant="h6" mb={2}>Cumulative Operating Cost (Line Chart)</Typography>
          <LineChart data={lineChartData} />
        </Box>
      )}
      {/* Geography Chart Section */}
      {dataType === "geo" && geoChartData.length > 0 && (
        <Box mt={4}>
          <Typography variant="h6" mb={2}>Geography (Map)</Typography>
          <GeographyChart data={geoChartData} />
        </Box>
      )}
      {(dataType === "costAggregateBar" && barChartData.length === 0) && (
        <Typography color="error" mt={2}>No cost data available for this item master.</Typography>
      )}
    </Box>
  );
};

export default Charts; 
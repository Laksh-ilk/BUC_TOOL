import React, { useContext, useState } from "react";
import { Box, IconButton, useTheme, Menu, MenuItem, Typography } from "@mui/material";
import { ColorModeContext, tokens } from "../../theme";
import InputBase from "@mui/material/InputBase";
import LightModeOutlinedIcon from "@mui/icons-material/LightModeOutlined";
import DarkModeOutlinedIcon from "@mui/icons-material/DarkModeOutlined";
import NotificationsOutlinedIcon from "@mui/icons-material/NotificationsOutlined";
import SettingsOutlinedIcon from "@mui/icons-material/SettingsOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import SearchIcon from "@mui/icons-material/Search";
import { useNavigate } from "react-router-dom";

const Topbar = () => {
  const theme = useTheme();
  const colors = tokens(theme.palette.mode);
  const colorMode = useContext(ColorModeContext);
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = useState(null);

  // Get user role from localStorage
  const role = localStorage.getItem("role");

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const handleMenuClick = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  return (
    <Box display="flex" justifyContent="space-between" p={2}>
      {/* SEARCH BAR */}
      <Box display="flex" backgroundColor={colors.primary[400]} borderRadius="3px">
        <InputBase sx={{ ml: 2, flex: 1 }} placeholder="Search" />
        <IconButton type="button" sx={{ p: 1 }}>
          <SearchIcon />
        </IconButton>
      </Box>

      {/* ICONS */}
      <Box display="flex">
        <IconButton onClick={colorMode.toggleColorMode}>
          {theme.palette.mode === "light" ? <LightModeOutlinedIcon /> : <DarkModeOutlinedIcon />}
        </IconButton>
        <IconButton>
          <NotificationsOutlinedIcon />
        </IconButton>
        <IconButton>
          <SettingsOutlinedIcon />
        </IconButton>

        {/* Profile Dropdown Menu */}
        <IconButton onClick={handleMenuClick}>
          <PersonOutlinedIcon />
        </IconButton>
        <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
          <MenuItem disabled>
            <Typography variant="body1">Role: {role || "Guest"}</Typography>
          </MenuItem>

          {/* Show menu options based on role */}
          {role === "Admin" &&
            [
              <MenuItem key="machine-rate" onClick={() => navigate("/machinerate")}>
                Machine Rate
              </MenuItem>,
              <MenuItem key="item-master" onClick={() => navigate("/itemmaster")}>
                Item Master
              </MenuItem>,
              <MenuItem key="approvals" onClick={() => navigate("/approvals")}>
                Approvals
              </MenuItem>,
            ]}

          {role === "Manager" &&
            [
              <MenuItem key="machine-rate" onClick={() => navigate("/machinerate")}>
                Machine Rate
              </MenuItem>,
              <MenuItem key="approvals" onClick={() => navigate("/approvals")}>
                Pending Approvals
              </MenuItem>,
            ]}

          {role === "Viewer" && (
            <MenuItem key="view-machine-rate" onClick={() => navigate("/machinerate")}>
              View Machine Rates
            </MenuItem>
          )}

          {/* Logout Option */}
          <MenuItem key="logout" onClick={handleLogout}>
            Logout
          </MenuItem>
        </Menu>
      </Box>
    </Box>
  );
};

export default Topbar;

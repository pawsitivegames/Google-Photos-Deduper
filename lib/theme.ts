import { createTheme } from "@mui/material/styles"

const theme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#007AFF",
      dark: "#005EC4",
      light: "#EAF4FF",
      contrastText: "#FFFFFF"
    },
    success: {
      main: "#34C759",
      light: "#E9FBEF",
      dark: "#248A3D"
    },
    warning: {
      main: "#FF9500",
      light: "#FFF4E5",
      dark: "#B86600"
    },
    error: {
      main: "#FF3B30",
      light: "#FFECEC",
      dark: "#C82018",
      contrastText: "#FFFFFF"
    },
    background: {
      default: "#F5F5F7",
      paper: "rgba(255,255,255,0.86)"
    },
    divider: "#D2D2D7",
    text: {
      primary: "#1D1D1F",
      secondary: "#6E6E73"
    }
  },
  typography: {
    fontFamily: [
      "-apple-system",
      "BlinkMacSystemFont",
      '"SF Pro Text"',
      '"SF Pro Display"',
      '"DM Sans"',
      '"Segoe UI"',
      "Arial",
      "sans-serif"
    ].join(","),
    h5: {
      fontWeight: 700,
      letterSpacing: 0
    },
    h6: {
      fontWeight: 700,
      letterSpacing: 0
    },
    button: {
      fontWeight: 700,
      letterSpacing: 0
    }
  },
  shape: {
    borderRadius: 8
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: "rgba(245,245,247,0.78)",
          color: "#1D1D1F",
          boxShadow: "0 1px 0 rgba(0, 0, 0, 0.08)",
          backdropFilter: "saturate(180%) blur(22px)"
        }
      }
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true
      },
      styleOverrides: {
        root: {
          textTransform: "none",
          borderRadius: 10,
          fontWeight: 600,
          boxShadow: "none",
          minHeight: 36,
          letterSpacing: 0
        }
      }
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: "none"
        }
      }
    },
    MuiChip: {
      styleOverrides: {
        root: {
          fontWeight: 600,
          borderRadius: 6
        }
      }
    },
    MuiToggleButton: {
      styleOverrides: {
        root: {
          textTransform: "none",
          fontWeight: 600,
          borderColor: "#D2D2D7",
          "&.Mui-selected": {
            color: "#007AFF",
            backgroundColor: "#EAF4FF"
          }
        }
      }
    },
    MuiTextField: {
      defaultProps: {
        variant: "outlined"
      }
    },
    MuiLinearProgress: {
      styleOverrides: {
        root: {
          borderRadius: 999,
          height: 7,
          backgroundColor: "#E5E5EA"
        }
      }
    }
  }
})

export default theme

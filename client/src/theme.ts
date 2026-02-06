import { createTheme } from '@mui/material/styles';

const theme = createTheme({
  palette: {
    primary: {
      main: '#1E2635',
      contrastText: '#FFFEF1',
    },
    secondary: {
      main: '#FEAA2D',
      contrastText: '#1E2635',
    },
    text: {
      primary: '#1E2635',
      secondary: '#676C72',
    },
    background: {
      default: '#f5f5f5',
      paper: '#ffffff',
    },
  },
  components: {
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: '#1E2635',
        },
      },
    },
    MuiButton: {
      styleOverrides: {
        contained: {
          '&.MuiButton-containedPrimary': {
            backgroundColor: '#1E2635',
            color: '#FFFEF1',
            '&:hover': {
              backgroundColor: '#2A3447',
            },
          },
          '&.MuiButton-containedSecondary': {
            backgroundColor: '#FEAA2D',
            color: '#1E2635',
            '&:hover': {
              backgroundColor: '#E6991A',
            },
          },
          '&:not(.MuiButton-containedPrimary):not(.MuiButton-containedSecondary):not(.MuiButton-containedError):not(.MuiButton-containedSuccess):not(.MuiButton-containedInfo):not(.MuiButton-containedWarning)': {
            backgroundColor: '#FEAA2D',
            color: '#1E2635',
            '&:hover': {
              backgroundColor: '#E6991A',
            },
          },
        },
      },
    },
  },
});

export default theme;

import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "@mui/material/styles";
import CssBaseline from "@mui/material/CssBaseline";
import theme from "./theme";
import Layout from "./components/Layout";

import Dashboard from "./pages/Dashboard";
import PoliciesList from "./pages/PoliciesList";
import UploadPage from "./pages/UploadPage";

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Layout />}>
            
            <Route index element={<Dashboard />} />
            
            <Route path="policies" element={<PoliciesList />} />
            <Route path="upload" element={<UploadPage />} />
            
            <Route path="*" element={<Dashboard />} />
            
          </Route>
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
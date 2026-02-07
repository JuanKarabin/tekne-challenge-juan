import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Alert,
  TextField,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  type SelectChangeEvent
} from "@mui/material";
import AutoAwesomeIcon from "@mui/icons-material/AutoAwesome";
import SearchIcon from "@mui/icons-material/Search";

import { getPolicies, getAiInsights } from "../services/api";
import type { Policy, AiInsightsResponse, PoliciesResponse, GetPoliciesParams } from "../services/api";

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'expired', label: 'Expired' },
  { value: 'cancelled', label: 'Cancelled' }
];

const POLICY_TYPE_OPTIONS = [
  { value: '', label: 'All' },
  { value: 'Property', label: 'Property' },
  { value: 'Auto', label: 'Auto' }
];

export default function PoliciesList() {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const limit = 25;
  
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [policyTypeFilter, setPolicyTypeFilter] = useState('');
  
  const [openAi, setOpenAi] = useState(false);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiData, setAiData] = useState<AiInsightsResponse | null>(null);

  const loadPolicies = useCallback(() => {
    const params: GetPoliciesParams = {
      limit,
      offset,
    };
    
    if (searchQuery.trim()) {
      params.q = searchQuery.trim();
    }
    if (statusFilter) {
      params.status = statusFilter;
    }
    if (policyTypeFilter) {
      params.policy_type = policyTypeFilter;
    }
    
    getPolicies(params)
      .then((res: PoliciesResponse) => {
        setPolicies(res.items || []);
        setTotal(res.pagination?.total || 0);
      })
      .catch(console.error);
  }, [limit, offset, searchQuery, statusFilter, policyTypeFilter]);

  useEffect(() => {
    loadPolicies();
  }, [loadPolicies]);

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setOffset(0);
  };

  const handleStatusChange = (e: SelectChangeEvent<string>) => {
    setStatusFilter(e.target.value as string);
    setOffset(0);
  };

  const handlePolicyTypeChange = (e: SelectChangeEvent<string>) => {
    setPolicyTypeFilter(e.target.value as string);
    setOffset(0);
  };

  const handlePrevPage = () => {
    setOffset(Math.max(0, offset - limit));
  };

  const handleNextPage = () => {
    setOffset(offset + limit);
  };

  const currentPage = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  const handleGenerateInsights = async () => {
    setOpenAi(true);
    setLoadingAi(true);
    setAiData(null);
    try {
      const res: AiInsightsResponse = await getAiInsights();
      setAiData(res);
    } catch (error) {
      console.error(error);
    } finally {
      setLoadingAi(false);
    }
  };

  return (
    <Box p={3}>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4">Policies List</Typography>
        
        <Button 
          variant="contained" 
          startIcon={<AutoAwesomeIcon />}
          onClick={handleGenerateInsights}
          sx={{
            backgroundColor: '#FEC42D !important',
            color: '#1a1a1a !important',
            '&:hover': { backgroundColor: '#e5b026 !important' },
          }}
        >
          Generate AI Insights
        </Button>
      </Box>

      <Paper sx={{ p: 2, mb: 3 }}>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, alignItems: 'center' }}>
          <Box sx={{ flex: '1 1 300px', minWidth: '200px' }}>
            <TextField
              fullWidth
              label="Search by Policy Number or Customer"
              variant="outlined"
              value={searchQuery}
              onChange={handleSearchChange}
              InputProps={{
                startAdornment: <SearchIcon sx={{ mr: 1, color: 'text.secondary' }} />
              }}
              placeholder="Search..."
            />
          </Box>
          <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
            <FormControl fullWidth>
              <InputLabel>Status</InputLabel>
              <Select
                value={statusFilter}
                onChange={handleStatusChange}
                label="Status"
              >
                {STATUS_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flex: '1 1 200px', minWidth: '150px' }}>
            <FormControl fullWidth>
              <InputLabel>Policy Type</InputLabel>
              <Select
                value={policyTypeFilter}
                onChange={handlePolicyTypeChange}
                label="Policy Type"
              >
                {POLICY_TYPE_OPTIONS.map((option) => (
                  <MenuItem key={option.value} value={option.value}>
                    {option.label}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
          <Box sx={{ flex: '0 1 auto' }}>
            <Button
              variant="outlined"
              onClick={() => {
                setSearchQuery('');
                setStatusFilter('');
                setPolicyTypeFilter('');
                setOffset(0);
              }}
              sx={{ backgroundColor: '#FEDD81', color: '#1a1a1a', borderColor: '#e8c96a', '&:hover': { backgroundColor: '#f5d66a', borderColor: '#e8c96a' } }}
            >
              Clear
            </Button>
          </Box>
        </Box>
      </Paper>

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Policy Number</TableCell>
              <TableCell>Customer</TableCell>
              <TableCell>Type</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Insured Value</TableCell>
              <TableCell align="right">Premium</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {policies.map((row) => (
              <TableRow key={row.policy_number}>
                <TableCell>{row.policy_number}</TableCell>
                <TableCell>{row.customer}</TableCell>
                <TableCell>{row.policy_type}</TableCell>
                <TableCell>
                  <Chip 
                    label={row.status} 
                    color={row.status === 'active' ? 'success' : 'default'} 
                    size="small" 
                  />
                </TableCell>
                <TableCell align="right">${Number(row.insured_value_usd).toLocaleString()}</TableCell>
                <TableCell align="right">${Number(row.premium_usd).toLocaleString()}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>

      <Box mt={2} display="flex" justifyContent="center" gap={2} alignItems="center">
        <Button disabled={offset === 0} onClick={handlePrevPage}>
          Previous
        </Button>
        <Typography variant="body2">
          Page {currentPage} of {totalPages} ({total} total)
        </Typography>
        <Button disabled={offset + limit >= total} onClick={handleNextPage}>
          Next
        </Button>
      </Box>

      <Dialog open={openAi} onClose={() => setOpenAi(false)} fullWidth maxWidth="sm">
        <DialogTitle>✨ AI Risk Analysis</DialogTitle>
        <DialogContent dividers>
          {loadingAi ? (
            <Box display="flex" justifyContent="center" p={3}>
              <CircularProgress />
            </Box>
          ) : aiData ? (
            <Box>
                <Box mb={2}>
                    <Chip label={`Analyzed: ${aiData.highlights.total_policies}`} sx={{ mr: 1 }} />
                    <Chip label={`Risks: ${aiData.highlights.risk_flags}`} color="error" variant="outlined" />
                </Box>
                
                <Typography variant="h6" gutterBottom>Insights</Typography>
                <List dense>
                    {aiData.insights.map((text, i) => (
                        <ListItem key={i}>
                            <ListItemText primary={text} />
                        </ListItem>
                    ))}
                </List>
                 {aiData.recommendations && (
                    <>
                      <Typography variant="h6" gutterBottom mt={2}>Recommendations</Typography>
                      <List dense>
                          {aiData.recommendations.map((text: string, i: number) => (
                              <ListItem key={i}>
                                  <ListItemText primary={text} />
                              </ListItem>
                          ))}
                      </List>
                    </>
                 )}
            </Box>
          ) : (
            <Alert severity="error">Failed to generate insights.</Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenAi(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
import { useState, useRef } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import DialogActions from '@mui/material/DialogActions';
import LinearProgress from '@mui/material/LinearProgress';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';

import { uploadFile } from '../services/api';
import type { UploadResponse } from '../services/api';

const ERROR_MESSAGES: Record<string, string> = {
  DUPLICATE_POLICY_NUMBER: 'Policy number already exists in the database',
  POLICY_NUMBER_REQUIRED: 'Policy number is required',
  INVALID_DATE_RANGE: 'Start date must be before end date',
  INVALID_STATUS: 'Status must be: active, expired, or cancelled',
  PROPERTY_VALUE_TOO_LOW: 'Property insured value must be at least $5,000',
  AUTO_VALUE_TOO_LOW: 'Auto insured value must be at least $10,000',
  INVALID_NUMBER: 'Numeric values are not valid',
};

export default function UploadPage() {
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [result, setResult] = useState<UploadResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setSelectedFile(file || null);
    setError(null);
    setResult(null);
  };

  const handleUpload = () => {
    if (!selectedFile) return;
    setError(null);
    setResult(null);
    setLoading(true);
    setModalOpen(true);

    uploadFile(selectedFile)
      .then((res) => {
        setResult(res);
      })
      .catch((err) => {
        let errorMessage = 'Error processing file';
        if (err.response?.data) {
          const data = err.response.data;
          if (data.errors && Array.isArray(data.errors)) {
            setResult({
              operation_id: data.operation_id || '',
              inserted_count: data.inserted_count || 0,
              rejected_count: data.rejected_count || 0,
              errors: data.errors,
            });
            return;
          }
          if (data.error) errorMessage = data.error;
          else if (data.message) errorMessage = data.message;
        } else if (err.message) {
          if (err.message.includes('Network Error') || err.message.includes('timeout')) {
            errorMessage = 'Connection error. Please check your connection and try again.';
          } else {
            errorMessage = err.message;
          }
        }
        setError(errorMessage);
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleLimpiar = () => {
    setSelectedFile(null);
    setResult(null);
    setError(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setResult(null);
    setError(null);
  };

  const hasErrors = result?.errors && result.errors.length > 0;
  const hasSuccess = result && !error;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" sx={{ mb: 3 }}>
        Upload Policies
      </Typography>

      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">
          CSV File Selector
        </Typography>
        <Box sx={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 2 }}>
          <Box
            component="label"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              px: 2,
              py: 1,
              backgroundColor: 'background.paper',
              cursor: 'pointer',
              minHeight: 40,
              boxSizing: 'border-box',
              '&:hover': { backgroundColor: 'action.hover' },
            }}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".csv"
              onChange={handleFileSelect}
              style={{ fontSize: '0.875rem', maxWidth: 260 }}
            />
          </Box>
          <Button
            variant="contained"
            size="medium"
            onClick={handleUpload}
            disabled={!selectedFile || loading}
            startIcon={<CloudUploadIcon />}
            sx={{
              backgroundColor: '#FEC42D !important',
              color: '#1a1a1a !important',
              '&:hover': { backgroundColor: '#e5b026 !important' },
            }}
          >
            Upload
          </Button>
          <Button
            variant="outlined"
            onClick={handleLimpiar}
            disabled={loading}
            sx={{
              backgroundColor: '#FEDD81',
              color: '#1a1a1a',
              borderColor: '#e8c96a',
              '&:hover': { backgroundColor: '#f5d66a', borderColor: '#e8c96a' },
            }}
          >
            Clear
          </Button>
        </Box>
        {selectedFile && (
          <Typography variant="caption" color="text.secondary">
            {selectedFile.name}
          </Typography>
        )}
      </Box>

      <Dialog 
        open={modalOpen} 
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown={loading}
      >
        <DialogTitle>
          {loading ? 'Processing file...' : hasSuccess ? 'Process completed' : 'Process error'}
        </DialogTitle>
        <DialogContent>
          {loading ? (
            <>
              <Box sx={{ width: '100%', mt: 2, mb: 2 }}>
                <LinearProgress />
              </Box>
              <Typography variant="body2" align="center" color="text.secondary">
                Validating business rules and inserting data.
              </Typography>
            </>
          ) : error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Error processing file
              </Typography>
              <Typography variant="body2">
                {error}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, fontSize: '0.875rem', color: 'text.secondary' }}>
                Please check the file and try again.
              </Typography>
            </Alert>
          ) : result ? (
            <Box sx={{ mt: 2 }}>
              <Alert 
                severity={hasErrors ? 'warning' : 'success'} 
                icon={hasErrors ? <ErrorIcon /> : <CheckCircleIcon />}
                sx={{ mb: 3 }}
              >
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  {hasErrors ? 'Process completed with errors' : 'Process completed successfully'}
                </Typography>
              </Alert>

              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Operation ID:
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {result.operation_id}
                </Typography>
              </Box>

              <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Inserted:
                  </Typography>
                  <Typography variant="h6" color="success.main" fontWeight="bold">
                    {result.inserted_count}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Rejected:
                  </Typography>
                  <Typography variant="h6" color="error.main" fontWeight="bold">
                    {result.rejected_count}
                  </Typography>
                </Box>
              </Box>

              {hasErrors && (
                <>
                  <Typography variant="h6" sx={{ mb: 2, color: 'error.main' }}>
                    Row Error Details
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: '#ffebee' }}>
                          <TableCell><strong>CSV Row</strong></TableCell>
                          <TableCell><strong>Field</strong></TableCell>
                          <TableCell><strong>Error Reason</strong></TableCell>
                        </TableRow>
                      </TableHead>
                      <TableBody>
                        {result.errors.map((row, idx) => (
                          <TableRow key={idx} hover>
                            <TableCell>{row.row_number}</TableCell>
                            <TableCell>{row.field}</TableCell>
                            <TableCell sx={{ color: 'error.main', fontWeight: 'medium' }}>
                              <Box>
                                <Typography variant="body2" fontWeight="bold">
                                  {row.code}
                                </Typography>
                                {ERROR_MESSAGES[row.code] && (
                                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                                      {ERROR_MESSAGES[row.code]}
                                  </Typography>
                                )}
                              </Box>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </TableContainer>
                </>
              )}
            </Box>
          ) : null}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseModal} variant="contained" color="secondary">
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
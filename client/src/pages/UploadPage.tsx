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

// Mapeo de códigos de error a mensajes descriptivos
const ERROR_MESSAGES: Record<string, string> = {
  DUPLICATE_POLICY_NUMBER: 'El número de póliza ya existe en la base de datos',
  POLICY_NUMBER_REQUIRED: 'El número de póliza es obligatorio',
  INVALID_DATE_RANGE: 'La fecha de inicio debe ser anterior a la fecha de fin',
  INVALID_STATUS: 'El estado debe ser: active, expired o cancelled',
  PROPERTY_VALUE_TOO_LOW: 'El valor asegurado para Property debe ser al menos $5,000',
  AUTO_VALUE_TOO_LOW: 'El valor asegurado para Auto debe ser al menos $10,000',
  INVALID_NUMBER: 'Los valores numéricos no son válidos',
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
        let errorMessage = 'Error al procesar el archivo';
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
            errorMessage = 'Error de conexión. Verifica tu conexión e intenta de nuevo.';
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
          Selector de archivo CSV
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
            Limpiar
          </Button>
        </Box>
        {selectedFile && (
          <Typography variant="caption" color="text.secondary">
            {selectedFile.name}
          </Typography>
        )}
      </Box>

      {/* MODAL CON LOADING Y RESULTADO */}
      <Dialog 
        open={modalOpen} 
        onClose={handleCloseModal}
        maxWidth="md"
        fullWidth
        disableEscapeKeyDown={loading}
      >
        <DialogTitle>
          {loading ? 'Procesando archivo...' : hasSuccess ? 'Proceso completado' : 'Error en el proceso'}
        </DialogTitle>
        <DialogContent>
          {loading ? (
            <>
              <Box sx={{ width: '100%', mt: 2, mb: 2 }}>
                <LinearProgress />
              </Box>
              <Typography variant="body2" align="center" color="text.secondary">
                Validando reglas de negocio e insertando datos.
              </Typography>
            </>
          ) : error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                Error al procesar el archivo
              </Typography>
              <Typography variant="body2">
                {error}
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, fontSize: '0.875rem', color: 'text.secondary' }}>
                Por favor, verifica el archivo e intenta nuevamente.
              </Typography>
            </Alert>
          ) : result ? (
            <Box sx={{ mt: 2 }}>
              {/* Mensaje de éxito/error */}
              <Alert 
                severity={hasErrors ? 'warning' : 'success'} 
                icon={hasErrors ? <ErrorIcon /> : <CheckCircleIcon />}
                sx={{ mb: 3 }}
              >
                <Typography variant="subtitle1" fontWeight="bold" gutterBottom>
                  {hasErrors ? 'Proceso completado con errores' : 'Proceso finalizado con éxito'}
                </Typography>
              </Alert>

              {/* Operation ID */}
              <Box sx={{ mb: 3 }}>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Operation ID:
                </Typography>
                <Typography variant="body1" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                  {result.operation_id}
                </Typography>
              </Box>

              {/* Inserted/Rejected Counts */}
              <Box sx={{ display: 'flex', gap: 3, mb: 3 }}>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Insertadas:
                  </Typography>
                  <Typography variant="h6" color="success.main" fontWeight="bold">
                    {result.inserted_count}
                  </Typography>
                </Box>
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Rechazadas:
                  </Typography>
                  <Typography variant="h6" color="error.main" fontWeight="bold">
                    {result.rejected_count}
                  </Typography>
                </Box>
              </Box>

              {/* Tabla de Errores */}
              {hasErrors && (
                <>
                  <Typography variant="h6" sx={{ mb: 2, color: 'error.main' }}>
                    Detalle de Errores por Fila
                  </Typography>
                  <TableContainer component={Paper} variant="outlined">
                    <Table size="small">
                      <TableHead>
                        <TableRow sx={{ backgroundColor: '#ffebee' }}>
                          <TableCell><strong>Fila CSV</strong></TableCell>
                          <TableCell><strong>Campo</strong></TableCell>
                          <TableCell><strong>Motivo del Error</strong></TableCell>
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
            Cerrar
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { pool } from './db';
import { handleUpload } from './controllers/uploadController';
import { listPolicies, getSummary } from './controllers/policyController';
import { getInsights } from './controllers/aiController';

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

const upload = multer({ storage: multer.memoryStorage() });

app.get('/health', async (req, res) => {
  try {
    const result = await pool.query('SELECT NOW()');
    res.json({
      status: 'OK',
      message: 'Server is running and DB is connected',
      db_time: result.rows[0].now,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('DB Error:', error);
    res.status(500).json({ status: 'ERROR', message });
  }
});

app.post('/upload', upload.single('file'), (req, res, next) => {
  void handleUpload(req, res).catch(next);
});

app.get('/policies', (req, res, next) => {
  void listPolicies(req, res).catch(next);
});
app.get('/policies/summary', (req, res, next) => {
  void getSummary(req, res).catch(next);
});

app.post('/ai/insights', (req, res, next) => {
  void getInsights(req, res).catch(next);
});

// Iniciar servidor
app.listen(port, () => {
  console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
# Challenge Tekne — Full Stack DEV AI

Bienvenido al repositorio del **Challenge Tekne**: una mini solución end-to-end (datos + API + UI) con reglas de negocio, trazabilidad y una feature de IA.

---

## Objetivo

Construir una aplicación full stack que permita **cargar pólizas desde CSV**, validarlas con un motor de reglas (OOP), persistirlas en PostgreSQL, consultarlas vía API y operar todo desde una UI en React, incluyendo insights generados por IA.

---

## ¿Qué hace este proyecto?

- **Upload de CSV:** `POST /upload` recibe un CSV de pólizas, valida cada fila (reglas técnicas + reglas de negocio), inserta solo las válidas y devuelve `operation_id`, `correlation_id`, `inserted_count`, `rejected_count` y errores por fila.
- **Persistencia:** Tablas `policies` y `operations` en PostgreSQL (cada upload registra una operación para trazabilidad).
- **API de consulta:** `GET /policies` (paginado, filtros por status, policy_type, búsqueda `q`) y `GET /policies/summary` (totales, count por status, premium por tipo).
- **Motor de reglas (OOP):** Clase base abstracta `BusinessRule`, reglas concretas (Property/Auto mínimo asegurado), `PolicyValidator` que aplica reglas por polimorfismo.
- **UI (React):** Pantallas Upload (selector CSV + Upload + Limpiar), Policies (tabla, paginado, filtros), Dashboard (cards con summary) y botón “Generate AI Insights” que llama a `POST /ai/insights`.
- **Observabilidad:** Logs estructurados (JSON) con `correlation_id`, `operation_id`, `endpoint`, `duration_ms`, `inserted_count`, `rejected_count`.

---

## Requerimientos

- **Node.js** 18+ (recomendado 20+)
- **PostgreSQL** (local o remoto)
- **npm** 7+ (workspaces)

Opcional para IA: **OPENAI_API_KEY** o **GOOGLE_API_KEY** en variables de entorno.

---

## Instalación

### 1. Clonar e instalar dependencias

```bash
git clone <url-del-repo>
cd tekne-challenge-juan
npm install
```

### 2. Base de datos

Crear la base en PostgreSQL y ejecutar en **pgAdmin** (o `psql`) los siguientes scripts contra la base `tekne_challenge`:

```sql
-- Habilitar extensión para generar UUIDs
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tabla de Operaciones (Uploads)
CREATE TABLE operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id UUID NOT NULL,
    correlation_id UUID NOT NULL,
    endpoint VARCHAR(50),
    status VARCHAR(20) CHECK (status IN ('RECEIVED', 'PROCESSING', 'COMPLETED', 'FAILED')),
    rows_inserted INT DEFAULT 0,
    rows_rejected INT DEFAULT 0,
    duration_ms INT,
    error_summary TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de Pólizas (Policies)
CREATE TABLE policies (
    policy_number VARCHAR(50) PRIMARY KEY,
    customer VARCHAR(100),
    policy_type VARCHAR(50),
    start_date DATE,
    end_date DATE,
    premium_usd NUMERIC(10, 2),
    status VARCHAR(20),
    insured_value_usd NUMERIC(12, 2),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

Desde terminal puedes crear solo la base antes de ejecutar el SQL:

```bash
createdb tekne_challenge
```

### 3. Variables de entorno (servidor)

En `server/.env` (crear si no existe):

```env
PORT=3000
DB_USER=postgres
DB_HOST=localhost
DB_NAME=tekne_challenge
DB_PASSWORD=tu_password
DB_PORT=5432

# Al menos uno para insights de IA
GOOGLE_API_KEY=...
# o
OPENAI_API_KEY=...
```

### 4. Arrancar backend y frontend

Desde la **raíz del proyecto**:

```bash
# Terminal 1 — Backend (Express en http://localhost:3000)
npm run server

# Terminal 2 — Frontend (Vite en http://localhost:5173, proxy /api → backend)
npm run client
```

O desde cada workspace:

```bash
cd server && npm run dev
cd client && npm run dev
```

Abrir **http://localhost:5173** en el navegador. La UI usa el proxy `/api` hacia el backend en el puerto 3000.

---

## Estructura del proyecto

```
tekne-challenge-juan/
├── client/                 # Frontend React (Vite)
│   ├── src/
│   │   ├── components/     # Layout, navegación
│   │   ├── pages/          # Dashboard, PoliciesList, UploadPage
│   │   ├── services/       # api.ts (axios, endpoints)
│   │   └── theme.ts
│   └── vite.config.ts      # Proxy /api → backend
├── server/                  # Backend Node.js + Express (TypeScript)
│   ├── src/
│   │   ├── controllers/    # uploadController, policyController, aiController
│   │   ├── domain/         # rules.ts (BusinessRule, PolicyValidator)
│   │   ├── repositories/   # policyRepository, operationRepository
│   │   ├── services/       # aiService (OpenAI / Gemini)
│   │   ├── types/
│   │   ├── db.ts
│   │   └── index.ts
│   └── scripts/
│       └── create-operations-table.sql
├── CHALLENGE.md            # Enunciado del desafío
├── DECISIONS.md            # Decisiones de diseño (OOP, paginado, idempotencia, escalado)
├── DEPLOY.md               # Cómo desplegar en Azure (Functions/App Service, Key Vault, App Insights, PostgreSQL, CI/CD)
├── README.md               # Este archivo
└── package.json            # Monorepo (workspaces: server, client)
```

---

## Notas relevantes

- **Formato CSV:** Cabecera con `policy_number,customer,policy_type,start_date,end_date,premium_usd,status,insured_value_usd`. El parser normaliza nombres (espacios → guión bajo, minúsculas).
- **Correlation ID:** El cliente puede enviar el header `x-correlation-id`; si no se envía, el servidor genera un UUID. Aparece en la respuesta, en la tabla `operations` y en los logs estructurados.
- **Documentación:** Ver `DECISIONS.md` para diseño OOP, paginado, duplicados y escalado; `DEPLOY.md` para despliegue en Azure (Functions/App Service, Key Vault, App Insights, PostgreSQL, CI/CD).
- **IA:** Si no hay `OPENAI_API_KEY` ni `GOOGLE_API_KEY`, el endpoint `POST /ai/insights` devuelve insights calculados a partir de los datos (sin modelo externo).
- **Dataset de ejemplo (IA):** Se incluye `insights_dataset.csv` en la raíz para probar uploads y que el modelo de IA “tenga de qué hablar”. Contiene **57 filas** con patrones intencionales:  \n  - **Control Group (Normal):** ~10 pólizas saludables con montos altos.  \n  - **High Risk Cluster:** ~35 pólizas `Property` con valores asegurados cerca del mínimo (entre 5000 y 5800 USD), pensado para disparar la alerta de “valores cercanos al umbral”.  \n  - **Rejection Trap:** ~12 pólizas de la empresa ficticia **FailLtd** diseñadas para fallar (Property < 5000 o Auto < 1000), para disparar la alerta de “alta tasa de rechazos”.

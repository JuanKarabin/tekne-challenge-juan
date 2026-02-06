# Deploy — Tekne Challenge (Azure)

Guía de alto nivel para desplegar backend (Node/Express) y frontend (React) en Azure, con observabilidad y secretos gestionados.

---

## 1. Opciones de cómputo

### Azure Functions (preferido para este proyecto)

- **Ventaja:** Pago por ejecución, escalado automático, integración nativa con App Insights y Key Vault.
- **Enfoque:** Una función HTTP que envuelve la app Express (ej. con `azure-functions-core-tools` y handler que delega a Express), o exponer solo los endpoints críticos como funciones individuales (upload como Blob trigger + HTTP para el resto).
- **Pasos resumidos:**
  - Crear Function App (Runtime: Node 20, Plan: Consumption o Premium).
  - Empaquetar el backend como función HTTP o como “custom handler” que levanta Express.
  - Configurar `WEBSITE_RUN_FROM_PACKAGE` o despliegue desde repo/CI.

### App Service (alternativa más directa)

- **Ventaja:** Despliegue clásico “contenedor de Node”: `npm start` o `node dist/index.js`.
- **Pasos resumidos:**
  - Crear App Service (Runtime stack: Node 20, Linux o Windows).
  - Desplegar código desde GitHub Actions / Azure DevOps (build `npm run build`, artefacto y deploy).
  - Variables de entorno y secretos se inyectan vía App Service Configuration o Key Vault references.

---

## 2. Secretos — Azure Key Vault

- Crear un **Key Vault** en el mismo subscription/resource group (o compartido).
- Guardar como secretos (o certificados si aplica):
  - `DATABASE-URL` o `POSTGRES-CONNECTION-STRING` (connection string de PostgreSQL).
  - `OPENAI-API-KEY` y/o `GOOGLE-API-KEY` (para el servicio de IA).
- **App Service / Functions:** Habilitar **Managed Identity** y dar a la identidad permisos “Get” sobre secretos en el Key Vault. En Configuration, añadir variables que referencien el Key Vault (ej. `@Microsoft.KeyVault(SecretUri=...)`) para que el runtime resuelva los valores sin ponerlos en texto plano.
- En local seguir usando `.env`; en Azure no commitear nunca `.env` y usar solo Key Vault + app settings.

---

## 3. Observabilidad — Application Insights

- Crear un recurso **Application Insights** en el mismo resource group y vincularlo a la Function App o App Service (en “Monitoring” → Application Insights).
- El SDK de Node (o el agente de Azure) captura automáticamente requests, dependencias y excepciones. Los **logs estructurados** (JSON con `correlation_id`, `operation_id`, `endpoint`, `duration_ms`, `inserted_count`, `rejected_count`) se pueden enviar con un logger que use `applicationInsights.defaultClient.trackTrace()` con propiedades, o dejando que stdout/stderr se capturen si el host está configurado para enviarlos a App Insights.
- **Métricas útiles:** solicitudes por endpoint, duración de `/upload`, tasa de errores, dependencias a PostgreSQL y a APIs de IA. Configurar alertas (ej. tasa de error > X %, latencia p95 > Y ms).

---

## 4. Base de datos — PostgreSQL administrado

- Usar **Azure Database for PostgreSQL** (Flexible Server recomendado).
- Crear servidor en la misma región que la app; configurar reglas de firewall para permitir solo la IP del App Service / Functions (o VNet integration si se usa).
- La **connection string** se guarda en Key Vault y se inyecta como variable de entorno (ej. `DATABASE_URL` o las variables que use `server/db.ts`).
- Ejecutar migraciones o scripts de creación de tablas (`policies`, `operations`) una sola vez (manual o paso en CI/CD contra la DB de staging/producción con credenciales de Key Vault).

---

## 5. Frontend (React)

- **Opción A:** Build estático (`npm run build` en el cliente) y hospedaje en **Azure Static Web Apps** o en un **Blob Storage + CDN** con Static Website habilitado. La API del backend se llama a la URL pública del App Service / Functions (CORS configurado en el backend).
- **Opción B:** Servir el build desde el mismo App Service (Express sirve `client/dist` en producción). Menos escalable por separado pero más simple.

---

## 6. CI/CD (high-level)

- **Repositorio:** GitHub o Azure Repos.
- **Pipeline (ej. GitHub Actions):**
  1. **Build backend:** `cd server && npm ci && npm run build`.
  2. **Build frontend:** `cd client && npm ci && npm run build`.
  3. **Tests:** `npm test` (si existen) en server y/o client.
  4. **Deploy backend:** Publicar artefacto en Azure (Functions: `func azure functionapp publish <name>`; App Service: Azure Web App deploy action con el artefacto del server).
  5. **Deploy frontend:** Si es Static Web Apps, usar la acción oficial de Azure; si es Blob/Static, subir contenido del build al storage.
- **Secretos en CI:** No poner connection strings ni API keys en el pipeline. Usar GitHub Secrets / Azure DevOps Variables y, en deploy, solo referenciar Key Vault o configurar app settings mediante Azure CLI/ARM en el pipeline.
- **Entornos:** Definir al menos `staging` y `production`; el pipeline despliega a staging en cada merge a `main` y a producción con aprobación manual o tag.

---

## Resumen de recursos Azure

| Recurso              | Uso                                      |
|----------------------|-------------------------------------------|
| Function App / App Service | Ejecutar backend Node (Express)     |
| Key Vault            | Connection string DB, API keys IA         |
| Application Insights | Logs, métricas, trazabilidad             |
| Azure Database for PostgreSQL | Persistencia policies + operations |
| Static Web Apps / Storage | Frontend React (opcional)           |

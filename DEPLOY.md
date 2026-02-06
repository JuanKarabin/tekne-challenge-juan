# Estrategia de Despliegue en Azure

Como parte del desafío, investigué cómo llevar esta solución local a un entorno productivo en la nube de Microsoft Azure. A continuación, detallo la arquitectura propuesta y el rol de cada componente.

---

## 1. Backend: Azure Functions (Compute)
Para ejecutar la API Node.js, evalué dos opciones principales: **App Service** (servidor tradicional) y **Azure Functions** (serverless).

**Mi elección: Azure Functions.**
* **Por qué:** Al ser un proyecto con tráfico variable (cargas de archivos puntuales), el modelo *serverless* es más eficiente. Solo consumimos recursos cuando realmente se procesa un archivo o se consulta la API.
* **Escalado:** Si recibimos 100 archivos CSV simultáneamente, Azure levanta automáticamente múltiples instancias de la función para procesarlos en paralelo, sin que yo tenga que configurar servidores adicionales.

## 2. Seguridad: Azure Key Vault (Secretos)
Actualmente, las credenciales (DB password, API Keys de IA) están en un archivo `.env` local. Esto es inseguro para producción.

**Solución:**
* Utilizaría **Azure Key Vault** para almacenar estos valores cifrados.
* La aplicación (Azure Function) se conectaría usando una *Managed Identity* (identidad gestionada) de Azure.
* **Ventaja:** El código nunca "toca" las contraseñas reales, solo solicita acceso a ellas en tiempo de ejecución. Eliminamos el riesgo de filtrar credenciales en el repositorio.

## 3. Base de Datos: Azure Database for PostgreSQL
En lugar de instalar y mantener PostgreSQL en una máquina virtual (lo cual requiere gestionar parches, backups y seguridad manual), optaría por el servicio gestionado (**PaaS**).

**Ventaja:**
* Alta disponibilidad automática.
* Backups automáticos configurables.
* Me permite centrarme en el esquema de datos y no en la administración del servidor de base de datos.

## 4. Observabilidad: Azure Application Insights
Para monitorear la salud de la aplicación sin acceder a los servidores, conectaría la Azure Function con **Application Insights**.

**Qué nos aporta:**
* **Logs centralizados:** Aprovechando que mi aplicación ya genera logs estructurados (JSON), App Insights puede indexarlos automáticamente.
* **Trazabilidad:** Podría buscar por `correlation_id` y ver todo el recorrido de una petición, desde que entra hasta que se guarda en la DB.
* **Alertas:** Configurar avisos si la tasa de rechazo de pólizas supera cierto umbral o si el tiempo de respuesta aumenta.

## 5. Automatización: CI/CD (High-Level)
Para evitar despliegues manuales propensos a error, implementaría un pipeline de CI/CD (por ejemplo, con GitHub Actions o Azure DevOps).

**El flujo sería:**
1.  **Commit:** Al subir código a la rama `main`.
2.  **Build & Test:** El pipeline instala dependencias y corre los tests unitarios.
3.  **Deploy:** Si los tests pasan, el pipeline despliega el código nuevo a la Azure Function.
    * *Nota:* Las migraciones de base de datos también podrían ejecutarse en este paso o mediante un job separado.
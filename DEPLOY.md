# DEPLOY.md — Cómo desplegar en Azure (guía básica)

Este documento explica **cómo desplegaría** el proyecto en Azure y **qué es cada pieza** que pide el challenge, de forma sencilla.

---

## 1. Dónde corre el backend: Azure Functions o App Service

El backend (Node.js + Express) tiene que estar en un servicio que reciba peticiones HTTP y ejecute nuestro código.

- **Azure Functions (preferido aquí):**  
  Es un servicio donde **subes tu código** y Azure **lo ejecuta cuando llega una petición** (por ejemplo una llamada a `POST /upload` o `GET /policies`). No tienes un “servidor encendido 24 horas”; pagas por cada ejecución. Azure se encarga de escalar: si hay muchas peticiones, lanza más ejecuciones. Para este proyecto es cómodo porque el tráfico puede ser irregular (pocos o muchos uploads al día).

- **App Service (alternativa):**  
  Es como **un servidor virtual** donde tu aplicación Node corre **todo el tiempo**. Creas un “App Service”, subes el código del backend y Azure lo mantiene encendido. Cualquier petición que llegue a la URL del App Service la atiende tu app. Es el modelo más parecido a “tengo un servidor con Node”. Si prefieres no usar Functions, App Service es la opción más directa.

**Resumen:** Elegiría **Azure Functions** para ahorro y escalado automático, o **App Service** si quiero “un servidor fijo” que siempre está corriendo.

---

## 2. Dónde guardar secretos: Key Vault

Las **contraseñas y claves** (cadena de conexión a la base de datos, API keys de OpenAI o Google) no deben estar escritas en el código ni en archivos subidos al repositorio.

- **Azure Key Vault** es un servicio que actúa como **caja fuerte**: guardas ahí los secretos (por ejemplo “connection-string-postgres” o “OPENAI_API_KEY”). La aplicación, cuando corre en Azure, **pide el valor al Key Vault** en lugar de leerlo de un archivo `.env` en el servidor. Así los secretos no aparecen en la configuración visible de la app; solo la app tiene permiso para leerlos (usando la identidad gestionada de Azure).  
- En local seguimos usando `.env`; en Azure no se sube `.env` y todo lo sensible va al Key Vault y se inyecta como variables de entorno que apuntan al Key Vault.

---

## 3. Logs y métricas: Application Insights

Necesitamos ver qué pasa en producción (errores, lentitud, cuántas peticiones hay).

- **Application Insights** es el servicio de Azure para **observabilidad**: recoge **logs** (lo que escribe tu app, por ejemplo nuestros JSON con `correlation_id`, `operation_id`, `duration_ms`) y **métricas** (cuántas peticiones por segundo, cuánto tarda cada endpoint, tasa de errores). Lo vinculas a tu Function App o App Service y, sin cambiar mucho el código, Azure empieza a capturar lo que la app escribe en la consola y a mostrarlo en un panel. Así puedes revisar problemas o rendimiento sin “entrar” al servidor.  
- Los logs estructurados que ya tenemos (JSON con correlation_id, operation_id, endpoint, duration_ms, inserted/rejected) son justo lo que App Insights puede usar para filtrar y hacer gráficos.

---

## 4. Base de datos: PostgreSQL administrado

La app usa PostgreSQL. En producción no pondríamos un PostgreSQL instalado a mano en una máquina; usaríamos un servicio gestionado.

- **Azure Database for PostgreSQL** es **PostgreSQL administrado por Azure**: Azure se encarga de instalación, backups, actualizaciones y mantenimiento. Tú creas un “servidor” de PostgreSQL en Azure, creas la base de datos (por ejemplo `tekne_challenge`), ejecutas nuestro script `server/scripts/init_db.sql` para crear las tablas `policies` y `operations`, y desde el backend te conectas con la **connection string** que te da Azure. Esa connection string es un secreto y se guarda en Key Vault; la app la lee desde ahí al arrancar.

---

## 5. CI/CD (automatización del despliegue)

**CI/CD** significa: en lugar de desplegar a mano cada vez que cambias código, un **pipeline** lo hace automáticamente.

- **Flujo típico:**  
  1. Subes código a un repositorio (por ejemplo GitHub).  
  2. Un **pipeline** (por ejemplo GitHub Actions o Azure DevOps) se dispara al hacer push (o al merge a `main`).  
  3. El pipeline: instala dependencias, ejecuta tests, hace el build del backend y del frontend.  
  4. Si todo va bien, **despliega** el backend a Azure (Functions o App Service) y el frontend donde corresponda (por ejemplo Azure Static Web Apps o el mismo App Service).  
- Los **secretos** (connection string, API keys) no se ponen en el pipeline en texto plano; el pipeline solo configura la app para que use Key Vault o variables que ya están en Azure.  
- Se suele tener al menos dos entornos: **staging** (pruebas) y **production**; el pipeline despliega a staging en cada cambio y a producción con un paso extra (aprobación manual o al hacer un release).

**Resumen:** CI/CD = “al subir código, se prueba, se construye y se despliega solo”, sin ejecutar comandos a mano en el servidor.

---

## Resumen: qué es cada cosa

| Qué pide el challenge | Qué es en términos simples |
|------------------------|----------------------------|
| **Azure Functions o App Service** | Donde corre el backend: Functions = se ejecuta por petición; App Service = servidor siempre encendido. |
| **Secrets en Key Vault** | Caja fuerte en la nube donde guardas connection string y API keys; la app los lee desde ahí. |
| **App Insights** | Servicio que recoge logs y métricas de la app para ver errores, lentitud y uso en producción. |
| **PostgreSQL managed** | Base de datos PostgreSQL que Azure administra (backups, actualizaciones); tú solo la usas con una connection string. |
| **CI/CD high-level** | Pipeline que, al subir código, hace build, tests y despliega a Azure de forma automática. |

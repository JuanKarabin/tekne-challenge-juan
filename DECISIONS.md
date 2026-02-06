# DECISIONS.md

Decisiones de diseño principales del proyecto Tekne Challenge.

---

- **OOP (motor de reglas):** Se usa una clase base abstracta `BusinessRule` y reglas concretas (`PropertyMinInsuredValueRule`, `AutoMinInsuredValueRule`). El `PolicyValidator` recibe una lista de reglas y las ejecuta sin saber qué regla es cada una (polimorfismo). Para añadir una regla nueva solo hace falta crear una nueva clase que extienda `BusinessRule`; no se toca el validador ni el flujo de upload.

- **Paginado (UI):** Se usa `limit` (por defecto 25, máximo 100) y `offset` para no traer todas las filas de una vez. Los botones Next/Prev cambian el `offset` y vuelven a pedir datos a la API. Es la forma más simple y encaja con el tamaño de datos que manejamos.

- **Duplicados e idempotencia:**  
  - **Duplicados:** En la base de datos `policy_number` es UNIQUE. Antes de insertar, se consulta qué números ya existen y las filas duplicadas se rechazan y se devuelven en la respuesta como error.  
  - **Idempotencia (opcional):** Si el usuario envía dos veces el mismo upload (por ejemplo doble clic o reintento por red), se podría evitar procesar dos veces lo mismo. Para eso: el cliente envía el header `x-correlation-id` (por ejemplo un mismo ID en ambos envíos). En el servidor, antes de procesar el CSV, se buscaría en la tabla `operations` si ya existe una operación con ese `correlation_id` y estado COMPLETED. Si existe, en lugar de validar e insertar de nuevo, se devolvería la misma respuesta que ya guardamos (mismo `operation_id`, mismos inserted/rejected, mismos errores). Así el usuario recibe siempre la misma respuesta y no se duplica trabajo ni datos.

- **Escalabilidad (cómo crecer si hay más uso):**  
  - **Backend sin estado (stateless):** El servidor no guarda en memoria nada que dependa de la “sesión” del usuario. Cada petición se responde con lo que viene en la request y lo que está en la base de datos. Eso permite tener **varias copias** del mismo backend corriendo; da igual qué copia atienda cada petición.  
  - **Load balancer:** Un servicio que reparte las peticiones entre esas varias copias del backend. Cuando llega una petición, el balanceador la manda a una de las instancias que esté menos cargada.  
  - **Base de datos:** Si la base se vuelve cuello de botella, se puede subir el **tier** del PostgreSQL (plan más potente: más CPU, RAM, disco). O usar **réplicas de solo lectura (read replicas):** copias de la base que solo sirven lecturas; las consultas GET se reparten entre la base principal y las réplicas para no saturar la principal.  
  - **Upload y archivos grandes:** Hoy el CSV se carga **en memoria** entero: el servidor lee el archivo completo en RAM y luego lo procesa. Si el archivo es muy grande, puede faltar memoria. Dos alternativas que se suelen usar: **(1) Streaming:** ir leyendo el archivo por trozos y procesando cada trozo sin cargar todo a la vez; **(2) Cola + worker:** el upload solo recibe el archivo, lo guarda (por ejemplo en un almacenamiento o en una cola) y responde “recibido”. Un proceso aparte (worker) va tomando archivos de la cola y los procesa. El usuario no espera al procesamiento y el servidor no se bloquea con archivos pesados.

- **Tradeoffs:**  
  - **Reglas en código (no en base de datos):** Cambiar una regla implica cambiar código y volver a desplegar. A cambio, tenemos tipos en TypeScript y podemos testear las reglas fácilmente.  
  - **Paginado por offset:** Con tablas muy grandes, usar `OFFSET` grande (por ejemplo “dame desde la fila 1 000 000”) puede ser lento porque la base tiene que “contar” hasta ahí. Para millones de filas se suele usar **paginado por cursor/keyset** (“dame las siguientes después del id X”), que escala mejor.  
  - **Logs en JSON a consola:** El servidor escribe cada log como una línea en formato JSON (con `correlation_id`, `operation_id`, `duration_ms`, etc.). Herramientas como Azure Application Insights pueden leer esas líneas desde la consola sin necesidad de instalar un SDK específico en la aplicación.

# DECISIONS.md

Decisiones de diseño principales del proyecto Tekne Challenge.

- **OOP:** Clase base abstracta `BusinessRule` y reglas concretas (`PropertyMinInsuredValueRule`, `AutoMinInsuredValueRule`); `PolicyValidator` aplica un array de reglas sin conocer el tipo (polimorfismo). Nuevas reglas = nueva clase, sin tocar el validador ni el upload.
- **Paginado (UI):** `limit` (default 25, max 100) y `offset` para alinear con la API y no cargar todo el dataset; Next/Prev recalculan offset. Simple y suficiente para listas acotadas.
- **Duplicados / idempotencia:** `policy_number` UNIQUE en DB; antes de insertar se consultan existentes y las duplicadas se rechazan en la respuesta. Opcional: usar `x-correlation-id` y tabla `operations` para detectar reenvíos y devolver el mismo resultado sin re-procesar.
- **Escalar:** Backend stateless; escalar instancias detrás de un load balancer. PostgreSQL con tier superior o read replicas si hace falta. Upload en memoria limita tamaño por request; archivos muy grandes → streaming o cola + worker.
- **Tradeoffs:** Reglas en código = tipos fuertes y cambios con deploy (no en DB). Offset simple pero en tablas enormes puede degradarse; para millones de filas, cursor/keyset. Logs JSON a stdout para App Insights sin SDK obligatorio.

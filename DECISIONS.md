# Decisiones de Diseño

Este documento resume las decisiones técnicas tomadas durante el desarrollo, basadas en la investigación de buenas prácticas para este tipo de desafíos.

---

### 1. Diseño Orientado a Objetos (Motor de Reglas)
Decidí implementar un patrón de estrategia simple para las validaciones.
* **Por qué:** Quería evitar un código lleno de `if/else` anidados dentro del controlador.
* **Cómo:** Creé una clase base `BusinessRule`. Cada regla nueva (ej: "Mínimo valor asegurado") es una clase separada que extiende de ella.
* **Beneficio:** Si mañana el negocio pide una regla nueva, solo creo un archivo nuevo sin tocar la lógica principal de la validación. Esto hace el sistema más mantenible y testear cada regla por separado es trivial.

### 2. Paginación en la UI
Opté por **Offset/Limit**.
* **Por qué:** Es el estándar más sencillo de implementar y suficiente para volúmenes de datos moderados.
* **Funcionamiento:** El frontend pide "dame 25 filas a partir de la 0", luego "25 a partir de la 25".
* **Trade-off:** Sé que para millones de registros este método puede volverse lento (la base de datos tiene que "saltar" muchas filas). En ese caso, cambiaría a una paginación por *Cursor* (basada en el ID del último elemento), pero para este alcance, Offset/Limit ofrece la mejor relación costo-beneficio.

### 3. Manejo de Duplicados e Idempotencia
Para garantizar la integridad de los datos:
* **Duplicados:** La base de datos impone la restricción `UNIQUE` en `policy_number`. El backend captura el error de violación de restricción y lo devuelve como un mensaje claro al usuario.
* **Idempotencia (Investigación):** Para evitar procesar el mismo archivo dos veces (ej: doble click erróneo), implementé el uso de un `correlation_id` y una tabla de `operations`. Antes de procesar, consultamos si esa operación ya fue completada exitosamente. Si es así, devolvemos el resultado guardado sin re-procesar.

### 4. Estrategia de Escalabilidad
Si la aplicación tuviera que manejar miles de usuarios concurrentes:
* **Backend Stateless:** La aplicación no guarda estado en memoria. Esto permite escalar horizontalmente (poner 10 copias del backend detrás de un balanceador de carga) sin problemas.
* **Lecturas vs Escrituras:** Podríamos usar "Read Replicas" en PostgreSQL. Una base maestra solo para escribir (Uploads) y varias réplicas solo para leer (Dashboard/Listados), aliviando la carga.

### 5. Trade-offs (Compromisos asumidos)
* **Validación Síncrona:** Actualmente, el archivo se procesa en el momento (el usuario espera con el spinner). Si el archivo fuera de 1GB, esto fallaría por *timeout*.
    * *Mejora futura:* Implementar procesamiento asíncrono (subir archivo -> devolver "OK, procesando" -> procesar en segundo plano -> notificar al usuario).
* **API Keys en Backend:** Por simplicidad, el backend llama directamente a la IA. En una arquitectura más compleja, quizás movería esto a un microservicio dedicado para aislar costos y cuotas.
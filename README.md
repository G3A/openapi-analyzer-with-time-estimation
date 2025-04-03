# 🚀 Analizador OpenAPI con Estimación de Tiempo

# ¡Descubre el Poder de la Visión Clara y la Automatización en tus Aplicaciones Legacy!

¿Te enfrentas a la ardua tarea de comprender, probar y modernizar aplicaciones complejas y heredadas? ¡No estás solo! Nuestra herramienta está aquí para transformar esa complejidad en claridad y automatización, permitiéndote tomar decisiones informadas y acelerar el proceso de modernización.

**¿Qué Hacemos?**

Analizamos a fondo tus aplicaciones legacy utilizando el estándar OpenAPI (a través de tu archivo `openapi.yaml`). Desglosamos cada servicio y operación, proporcionándote una evaluación detallada de su complejidad y el esfuerzo necesario para probarlo y modernizarlo.

**¡Novedad!** Ahora también generamos automáticamente una **colección Postman** lista para usar, con cada uno de los endpoints definidos en tu `openapi.yaml`. ¡Y aún hay más! Incluimos **esqueletos de pruebas sugeridas** para cada endpoint, basándonos en el análisis de complejidad que realizamos.

**¿Por Qué es Importante?**

*   **Planificación Inteligente:** Obtén estimaciones precisas en horas para las pruebas de cada servicio, lo que te permite planificar y asignar recursos de manera eficiente.
*   **Toma de Decisiones Informada:** Comprende a fondo la complejidad de tu sistema, facilitando la toma de decisiones sobre mejoras, migraciones y actualizaciones.
*   **Ahorro de Tiempo y Recursos:** Acelera el proceso de exploración y evaluación inicial, evitando costosos errores y retrasos.
*   **Automatización de Pruebas:** Comienza a probar tus APIs de inmediato con la colección Postman generada automáticamente y los esqueletos de pruebas.
*   **Colaboración Mejorada:** Facilita la comunicación entre equipos de desarrollo y gestión de proyectos al proporcionar una visión clara y compartida del sistema, junto con herramientas prácticas para la prueba y validación.

**¿Cómo Funciona?**

Nuestra herramienta utiliza tu archivo `openapi.yaml` para identificar y analizar cada servicio y operación en tu aplicación. Luego, aplica una metodología de evaluación de complejidad basada en los tipos de prueba requeridos, generando estimaciones de tiempo precisas.

Además, **automáticamente creamos una colección Postman con todas tus APIs** y **generamos esqueletos de pruebas sugeridas** en formato JSON para cada endpoint. ¡Esto te permite comenzar a probar tus APIs de forma rápida y sencilla!

**¡Comienza Hoy Mismo!**

## 🔍 Descripción

Esta herramienta avanzada ofrece un **análisis completo de APIs** descritas en OpenAPI, incluyendo:

- 📊 Identificación automática de servicios y operaciones
- � Generación de colecciones Postman listas para usar
- 🧪 Esqueletos de pruebas automatizadas pre-configuradas
- ⏱️ Estimaciones precisas de tiempo para desarrollo y testing

**Beneficios clave:**
✅ Exportación 1-click a Postman  
✅ Pruebas pre-configuradas por nivel de complejidad  
✅ Ahorra horas de configuración manual  
✅ Ideal para documentación y onboarding  


## ⚙️ Instalación Rápida

### Prerrequisitos
1. Configura tu `pom.xml`:

```xml
<!-- Dependencia -->
<dependency>
    <groupId>io.smallrye</groupId>
    <artifactId>smallrye-open-api-jaxrs</artifactId>
    <version>2.3.1</version> 
</dependency>

<!-- Plugin -->
<plugin>
    <groupId>io.smallrye</groupId>
    <artifactId>smallrye-open-api-maven-plugin</artifactId>
    <version>2.3.1</version> 
    <executions>
        <execution>
            <goals>
                <goal>generate-schema</goal>
            </goals>
        </execution>
    </executions>
</plugin>
```

2. Genera el archivo OpenAPI:
```bash
mvn clean package
```

## 🏗️ Qué Incluye la Colección Postman

✔️ Todos los endpoints organizados por categorías
✔️ Variables de entorno pre-configuradas
✔️ Ejemplos de request/response
✔️ Pruebas automatizadas básicas para:

    Validación de esquemas
    Códigos de estado HTTP
    Tiempos de respuesta

// Ejemplo de test skeleton incluido:
pm.test("Respuesta válida para GET /api/users", () => {
    pm.expect(pm.response.code).to.be.oneOf([200, 401]);
    pm.response.to.have.jsonSchema(schema);
});


## 💡 Tip profesional: Usa la colección generada como base para tus pruebas de regresión!

## 🚀 Cómo Usar

1. Instala dependencias:
```bash
npm i
```

2. Ejecuta el analizador:
```bash
node index.js ruta/a/tu/openapi.yml
```

## 📊 Resultados Esperados

La herramienta generará un reporte detallado que incluye:

- 🔎 Listado completo de servicios
- 🧮 Estimación de horas por tipo de prueba
- 📌 Recomendaciones de priorización
- 📅 Planificación sugerida

## 🤝 Contribuciones

¡Contribuciones son bienvenidas! Por favor abre un issue o envía un PR.

---

📌 **Nota:** Asegúrate de tener configurada la versión correcta de JDK antes de ejecutar.

💡 **Tip:** Usa los resultados para planificar sprints más eficientes!



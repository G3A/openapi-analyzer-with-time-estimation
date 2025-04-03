# 🚀 Analizador OpenAPI con Estimación de Tiempo

# ¡Descubre el Poder de la Visión Clara en tus Aplicaciones Legacy!

¿Te enfrentas a la ardua tarea de comprender y modernizar aplicaciones complejas y heredadas? ¡No estás solo! Nuestra herramienta está aquí para transformar esa complejidad en claridad, permitiéndote tomar decisiones informadas y estratégicas.

**¿Qué Hacemos?**

Analizamos a fondo tus aplicaciones legacy utilizando el estándar OpenAPI (a través de tu archivo `openapi.yaml`). Desglosamos cada servicio y operación, proporcionándote una evaluación detallada de su complejidad y el esfuerzo necesario para probarlo y modernizarlo.

**¿Por Qué es Importante?**

*   **Planificación Inteligente:** Obtén estimaciones precisas en horas para las pruebas de cada servicio, lo que te permite planificar y asignar recursos de manera eficiente.
*   **Toma de Decisiones Informada:** Comprende a fondo la complejidad de tu sistema, facilitando la toma de decisiones sobre mejoras, migraciones y actualizaciones.
*   **Ahorro de Tiempo y Recursos:** Acelera el proceso de exploración y evaluación inicial, evitando costosos errores y retrasos.
*   **Colaboración Mejorada:** Facilita la comunicación entre equipos de desarrollo y gestión de proyectos al proporcionar una visión clara y compartida del sistema.

**¿Cómo Funciona?**

Nuestra herramienta utiliza tu archivo `openapi.yaml` para identificar y analizar cada servicio y operación en tu aplicación. Luego, aplica una metodología de evaluación de complejidad basada en los tipos de prueba requeridos, generando estimaciones de tiempo precisas.

**¡Comienza Hoy Mismo!**

## 🔍 Descripción

Esta potente herramienta está diseñada para **analizar aplicaciones legacy** de forma exhaustiva, proporcionando:

- 📊 Identificación automática de servicios y operaciones
- 🏷️ Clasificación por niveles de complejidad
- ⏱️ Estimaciones precisas de tiempo para pruebas
- 📈 Información estratégica para migraciones

**Beneficios clave:**
✅ Acelera la evaluación de sistemas legacy  
✅ Facilita la planificación de proyectos  
✅ Optimiza la asignación de recursos  

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



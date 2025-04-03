# Lea atentamente

Esta aplicación avanzada ha sido diseñada para realizar un análisis exhaustivo y estructurado de aplicaciones legacy. Su misión principal es ofrecer una comprensión clara y detallada de los servicios que integran el sistema existente, lo cual es esencial para planificar mejor las futuras mejoras o migraciones tecnológicas.

Utilizando el archivo openapi.yaml, que es un estándar de descripción de APIs, mi herramienta identifica automáticamente cada servicio y operación descrito. Luego, proporciona una evaluación precisa y detallada de la complejidad de cada uno, clasificada según distintos niveles de prueba posible.

Estas evaluaciones van acompañadas de estimaciones en horas que se basan en el tipo y complejidad de la prueba requerida para cada servicio. Esto permite a los equipos de desarrollo y gestión de proyectos calcular con mayor precisión los esfuerzos necesarios para comprender, probar y eventualmente modificar o actualizar el sistema.

La aplicación no solo facilita la toma de decisiones informadas, sino que también agiliza el proceso inicial de exploración y evaluación de aplicaciones legacy, contribuyendo a una gestión más eficiente y estratégica de proyectos de tecnología.

## Prerrequisitos:

1. Poner la dependencia y plugin encargados de generar el  archivo openapi.yaml en su archivo pom.xml
   
```maven
<dependency>
	<groupId>io.smallrye</groupId>
	<artifactId>smallrye-open-api-jaxrs</artifactId>
	<version>2.3.1</version> 
</dependency>
```
   
```maven 
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
2. Ejecutar el comando maven   (Asegure que tiene seteado la versión del JDK correcto)

```bash
    mvn clean package
```	


## Modo de uso:

1. Abre una ventana cmd en la ruta donde está el archivo index.js 
2. Asegúrate de instalar las librerías:

```bash
    npm i
```	

3. Ejecútalo desde la terminal:

```bash
    node index.js ruta/a/tu/openapi.yml
```	

# alexa-skill-rayos-uva

"Rayos UVA", una Skill sencilla para Amazon Alexa que consume API externa de AEMET y utiliza Auto Delegation en el modelo. https://www.amazon.es/Javier-Campos-Rayos-UVA/dp/B07PNQ2XCS/

Esta skill obtiene de AEMET la previsión de radiación de rayos ultravioleta (UV) en los principales municipios de España. La previsión está disponible para hoy, mañana, pasado mañana y dentro de 3 días.

Código fuente traducido a castellano y con comentarios "extra" para fines educativos.

Siénte libre para utilizar este proyecto como punto de partida para crear una skill que consuma APIs externas.

## Configuración

Para reutilizar esta skill, recuerda hacer estos cambios:
1. En el fichero 'package.json', editar 'name', 'description' y 'author'.
2. En el fichero del modelo (modelo/es-ES.json), editar 'invocationName'.
3. En el fichero 'index.js', editar la API KEY de AEMET. Esta key puedes obtenerla gratis en la web de AEMET.

## Otras consideraciones

1. Al configurar tu función Lambda en AWS, recuerda habilitar que solo pueda ser invocada por el APPLICATION_ID de tu Skill. Esde ID lo obtendrás en https://developer.amazon.com/alexa/console/ask
2. Para generar obtener los módulos node necesarios, ejecuta "npm install" en la carpeta ./lambda. Si utilizas la nueva funcionalidad de edición de código online, en el panel de desarrollador Alexa, no es necesario que ejecutes dicho comando; se ejecutará automáticamente en el despliegue del código.

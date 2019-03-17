const Alexa = require('ask-sdk-core');
const https = require('https');

const API_KEY = "<API KEY HERE>"; // obtener en https://opendata.aemet.es

const EXPLICACION_RADIACION_BAJA = "Para niveles 1 y 2, puede permanecer  en el exterior sin riesgo.";
const EXPLICACION_RADIACION_MEDIA = "Para niveles entre 3 y 6, manténgase a la sombra durante las horas centrales del día, póngase camisa, crema de protección solar y sombrero.";
const EXPLICACION_RADIACION_ALTA = "Para niveles superiores a 7, evite salir durante las horas centrales del día y busque sombra, son imprescindibles camisa, crema de protección solar y sombrero con dichos niveles.";
const AYUDA_TEXTO = 'Esta skill te informa de la predicción de índice de radiación ultravioleta máximo, en condiciones de cielo despejado, en los principales municipios de España. La fuente de la información es la Agencia Estatal de Meteorología (AEMET). La protección frente a la radiación ultravioleta incluye consultar el índice previsto, utilizar cremas y lociones protectoras así como gafas de sol y no exponerse al sol en las horas centrales del día. Especial atención requieren los niños y las personas con piel clara. Dependiendo del valor del UVI, el ciudadano (en función también de su tipo de piel (fototipo), edad, etc) debe tomar las medidas adecuadas para su protección de la radiación ultravioleta. ' + EXPLICACION_RADIACION_BAJA + ' ' + EXPLICACION_RADIACION_MEDIA + ' ' + EXPLICACION_RADIACION_ALTA + ' Dime por ejemplo: ¿Qué radiación hace en Madrid hoy?';

const LaunchRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'LaunchRequest';
    },
    handle(handlerInput) {
        const speechText = 'Bienvenido a Rayos UVA. Dime por ejemplo "Ayuda" o "¿Qué radiación hará en Valencia mañana?"';
        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
    }
};

function cuandoToCodigo(cuando){
    if(cuando == "hoy")return 0;
    else if(cuando == "mañana") return 1;
    else if (cuando == "pasado") return 2;
    else if (cuando == "dentro de tres días") return 3;
    else{ // caso imposible
        return null;
    }
}

const ConsultarRadiacionIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'ConsultarRadiacionIntent';
    },
    async handle(handlerInput) {
        
        const ciudad = handlerInput.requestEnvelope.request.intent.slots.ciudadSlot.resolutions.resolutionsPerAuthority[0].values[0].value.name;
        const cuando = handlerInput.requestEnvelope.request.intent.slots.cuandoSlot.resolutions.resolutionsPerAuthority[0].values[0].value.name;
        
        let dia = cuandoToCodigo(cuando);
        if(dia == null){ // caso imposible
            let speechText = "No te he entendido, lo siento. ¡Hasta luego!";
            return handlerInput.responseBuilder
                .speak(speechText)
                .withShouldEndSession(true)
                .getResponse();
        }
        
        let nivel = await httpGetUvaDia(dia, ciudad);
        if(nivel == null){
            let speechText = "Error al obtener el nivel de radiación de AEMET. Lo siento, inténtalo más tarde. ¡Hasta luego!";
            return handlerInput.responseBuilder
                .speak(speechText)
                .withShouldEndSession(true)
                .getResponse();
        }
        else if(nivel == -1){
            let speechText = "Municipio no encontrado en AEMET. Lo siento. ¡Hasta luego!";
            return handlerInput.responseBuilder
                .speak(speechText)
                .withShouldEndSession(true)
                .getResponse();
        }
        
        let explicacionNivel = obtenerExplicacionPorNivel(nivel);
        
        let speechText = 'El nivel de radiación en ' + ciudad + " " + cuando + ' es ' + nivel + '. ' + 
            explicacionNivel + ' Información obtenida de la Agencia Estatal de Meteorología hace 1 segundo. ¡Hasta luego!';
        
        return handlerInput.responseBuilder
            .speak(speechText)
            .withShouldEndSession(true)
            .getResponse();
    }
};

function obtenerExplicacionPorNivel(nivel){
    if(nivel == 0 || nivel == 1 || nivel == 2)
        return EXPLICACION_RADIACION_BAJA;
    else if(nivel >= 3 && nivel <= 6)
        return EXPLICACION_RADIACION_MEDIA;
    else
        return EXPLICACION_RADIACION_ALTA;
}

async function httpGetUvaDia(dia, ciudad) {
  
    var url = 'https://opendata.aemet.es/opendata/api/prediccion/especifica/uvi/' + encodeURI(dia);
    
    var headers = { 
        'Accept': 'application/json',
        'api_key': API_KEY
    };

    let respuesta = JSON.parse(await httpGeneric(url,'GET', headers));
    
    if(respuesta && respuesta.datos){
        let niveles = await httpGeneric(respuesta.datos, 'GET', null);
        
        let i = niveles.indexOf(ciudad);
        if(i == -1) return -1;
        else{
            /* El siguiente código es feo. Hay un error en la API de AEMET, 
             * que devuelve la info en texto plano en lugar de json, aunque en la 
             * documentación y en la cabecera especifica json. Como es texto plano, 
             * el parseo de la info queda menos elegante en el código. */
            let sub = niveles.substr(i);
            i = sub.indexOf("\r");
            if(i == -1) return -1;
            
            sub = sub.substring(0, i); // fila del municipio
            
            i = sub.lastIndexOf(",");
            if(i == -1) return -1;
            
            sub = sub.substring(i+1);
            
            return sub.replace(/\"/g, ''); // quitar comillas
        }
        
    }
    else{
        return null;
    }
}

function httpGeneric(url, method, headers){
    
    var parsedUrl = require('url').parse(url);
    
    return new Promise(((resolve, reject) => {
      var options = {
          host: parsedUrl.hostname,
          path: parsedUrl.path,
          method: method
      };

      options.port = (parsedUrl.protocol == "https:") ? 443 : 80;
  
      if(headers != null){
        options.headers = headers;
      }
      
      const request = https.request(options, (response) => {
          
        configurarEncoding(response);
        
        let returnData = '';
  
        response.on('data', (chunk) => {
          returnData += chunk;
        });
  
        response.on('end', () => {
          resolve(returnData);
        });
  
        response.on('error', (error) => {
          console.log("error httpGeneric: " + error);
          reject(error);
        });
      });
      request.end();
    }));
  }
  
function configurarEncoding(response){
    
    response.setEncoding('latin1'); // forzar codificacicón ya que la API de AEMET utiliza esta codificación.
}



const HelpIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && handlerInput.requestEnvelope.request.intent.name === 'AMAZON.HelpIntent';
    },
    handle(handlerInput) {
        const speechText = AYUDA_TEXTO;

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
    }
};
const CancelAndStopIntentHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest'
            && (handlerInput.requestEnvelope.request.intent.name === 'AMAZON.CancelIntent'
                || handlerInput.requestEnvelope.request.intent.name === 'AMAZON.StopIntent');
    },
    handle(handlerInput) {
        const speechText = '¡Hasta luego!';
        return handlerInput.responseBuilder
            .speak(speechText)
            .withShouldEndSession(true)
            .getResponse();
    }
};
const SessionEndedRequestHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'SessionEndedRequest';
    },
    handle(handlerInput) {
        // Any cleanup logic goes here.
        return handlerInput.responseBuilder.getResponse();
    }
};

// The intent reflector is used for interaction model testing and debugging.
// It will simply repeat the intent the user said. You can create custom handlers
// for your intents by defining them above, then also adding them to the request
// handler chain below.
const IntentReflectorHandler = {
    canHandle(handlerInput) {
        return handlerInput.requestEnvelope.request.type === 'IntentRequest';
    },
    handle(handlerInput) {
        const intentName = handlerInput.requestEnvelope.request.intent.name;
        const speechText = `You just triggered ${intentName}`;

        return handlerInput.responseBuilder
            .speak(speechText)
            //.reprompt('add a reprompt if you want to keep the session open for the user to respond')
            .getResponse();
    }
};

// Generic error handling to capture any syntax or routing errors. If you receive an error
// stating the request handler chain is not found, you have not implemented a handler for
// the intent being invoked or included it in the skill builder below.
const ErrorHandler = {
    canHandle() {
        return true;
    },
    handle(handlerInput, error) {
        console.log(`~~~~ Error handled: ${error.message}`);
        const speechText = `Lo siento, no te he entendido. Repite por favor.`;

        return handlerInput.responseBuilder
            .speak(speechText)
            .reprompt(speechText)
            .getResponse();
    }
};

// This handler acts as the entry point for your skill, routing all request and response
// payloads to the handlers above. Make sure any new handlers or interceptors you've
// defined are included below. The order matters - they're processed top to bottom.
exports.handler = Alexa.SkillBuilders.custom()
    .addRequestHandlers(
        LaunchRequestHandler,
        ConsultarRadiacionIntentHandler,
        HelpIntentHandler,
        CancelAndStopIntentHandler,
        SessionEndedRequestHandler,
        IntentReflectorHandler) // make sure IntentReflectorHandler is last so it doesn't override your custom intent handlers
    .addErrorHandlers(
        ErrorHandler)
    .lambda();

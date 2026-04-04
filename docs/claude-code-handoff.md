# BUMEET - Claude Code Handoff

## Resumen ejecutivo

Este repositorio contiene el inicio del agente local de escritorio para BUMEET.

Estado actual:

- Proyecto Python base creado y publicado en GitHub.
- Configuracion local persistente implementada.
- Bus de eventos asincrono implementado.
- Cliente BLE base sobre `bleak` implementado.
- Motor completo de simulacion sin hardware implementado.
- UI de simulacion en Tkinter implementada.
- Suite unitaria basica pasando.

Objetivo de esta base:

- Permitir desarrollar y demostrar el flujo del MVP sin depender todavia del dispositivo BLE real ni de la deteccion nativa de Windows/macOS.

## Repo y estructura relevante

- `src/bumeet_agent/app.py`: entrypoint CLI y UI.
- `src/bumeet_agent/bootstrap.py`: contenedor de runtime.
- `src/bumeet_agent/config.py`: modelos de configuracion y persistencia JSON.
- `src/bumeet_agent/events/bus.py`: pub-sub asincrono.
- `src/bumeet_agent/events/models.py`: topicos y eventos.
- `src/bumeet_agent/domain/status.py`: snapshots de hardware y estados.
- `src/bumeet_agent/domain/state_machine.py`: traduccion hardware -> free/busy.
- `src/bumeet_agent/ble/client.py`: cliente BLE real sobre `bleak`.
- `src/bumeet_agent/ble/protocol.py`: serializacion de payloads.
- `src/bumeet_agent/ble/simulated.py`: backend BLE fake para pruebas y demos.
- `src/bumeet_agent/detection/service.py`: detector simulado, escenarios y orquestador.
- `src/bumeet_agent/ui/simulator.py`: interfaz Tkinter para visualizar simulaciones.
- `src/bumeet_agent/simulation.py`: runner reutilizable de simulacion.
- `tests/unit/`: pruebas actuales.

## Entorno local

Workspace:

- `/Users/antoniorodes/Documents/BUMEET`

Python virtualenv configurado:

- `/Users/antoniorodes/Documents/BUMEET/.venv`

Python detectado durante la sesion:

- `3.13.3`

Dependencias runtime instaladas en el venv durante esta sesion:

- `bleak`
- `platformdirs`
- `pydantic`

## Comandos utiles

### Activar entorno

```bash
cd /Users/antoniorodes/Documents/BUMEET
source .venv/bin/activate
```

### Ejecutar simulacion CLI

```bash
PYTHONPATH=src python -m bumeet_agent.app --simulate --scenario default --delay-scale 0
```

### Ejecutar UI de simulacion

```bash
PYTHONPATH=src python -m bumeet_agent.app --simulate-ui
```

### Ejecutar tests

```bash
.venv/bin/python -m unittest discover -s tests/unit -v
```

## Como probar manualmente desde la UI

1. Abrir terminal en la carpeta del repo.
2. Activar el entorno virtual:

```bash
source .venv/bin/activate
```

3. Lanzar la interfaz:

```bash
PYTHONPATH=src python -m bumeet_agent.app --simulate-ui
```

4. En la ventana:

- Elegir un escenario en `Scenario`.
- Opcionalmente ajustar `Delay scale`.
- Pulsar `Run simulation`.

5. Verificar en pantalla:

- `App`: cambia de `Idle` a `Running` y luego `Completed`.
- `Occupancy`: cambia entre `free` y `busy`.
- `BLE`: pasa por `connected` y `disconnected`.
- `Last payload`: muestra `01` cuando pasa a ocupado y `00` cuando vuelve a libre.
- `Resources`: muestra `camera`, `microphone` o `none`.
- `Events`: aumenta conforme se emiten eventos.
- Log inferior: muestra el detalle cronologico de eventos y payloads.

6. Escenarios disponibles:

- `default`: entra una llamada y termina.
- `bounce`: alternancias rapidas busy/free para probar rebotes.
- `camera-only`: actividad solo por camara.

7. Para dejar la UI limpia antes de otra prueba:

- Pulsar `Clear log`.

## Comportamiento esperado en simulacion

### Escenario `default`

Secuencia funcional esperada:

- Estado inicial `free`.
- Detector simulado emite uso de microfono.
- State machine cambia a `busy`.
- Cliente BLE fake escribe payload `01`.
- Detector simulado emite fin de uso.
- State machine cambia a `free`.
- Cliente BLE fake escribe payload `00`.

### Escenario `bounce`

Secuencia esperada de payloads:

- `01`
- `00`
- `01`
- `00`

## Estado validado en esta sesion

Validaciones ejecutadas:

- Smoke test del runner de simulacion: OK.
- Escenario `bounce` ejecutado en snippet Python: OK.
- Suite unitaria: `5 tests`, todos OK.

Resultado observado del escenario `bounce`:

- `writes = ['01', '00', '01', '00']`

## Decisiones de arquitectura ya tomadas

- Mantener desacoplamiento entre deteccion, dominio y transporte BLE.
- Usar inyeccion de factorias para poder sustituir el backend BLE real por uno fake.
- Preparar el proyecto para evolucionar a deteccion real por OS sin rehacer el flujo principal.
- Priorizar simulacion y testabilidad antes de integrar hardware real.

## Lo que todavia NO esta hecho

- Deteccion real en Windows.
- Deteccion real en macOS.
- Tray app real con `pystray`.
- Formulario o panel de configuracion de MAC/device id y UUIDs.
- Integracion BLE real contra el dispositivo CoreInk/M5Stack.
- Empaquetado de desktop app.
- Telemetria cloud.

## Nuevo requisito funcional (prioritario)

Desde la aplicacion de usuario (web/app), el usuario debe poder enviar mensajes personalizados a la pantalla de tinta.

Capacidades minimas esperadas:

- Campo de texto para mensaje libre (ejemplo: "No molestar, reunion hasta las 12:30").
- Plantillas rapidas (ejemplo: "En llamada", "Concentrado", "Vuelvo en 10 min").
- Boton de envio inmediato al dispositivo.
- Previsualizacion del mensaje antes de enviar.
- Registro de ultimo mensaje enviado y timestamp.
- Validaciones de longitud y caracteres permitidos.

Implicacion tecnica para el agente local:

- Definir un nuevo comando de dominio tipo `display.custom_message`.
- Serializar payload para mensaje (ademas de `busy/free`).
- Soportar recepcion del comando desde backend local o API de sincronizacion futura.
- Mantener compatibilidad con el flujo existente de `busy/free`.

Implicacion tecnica para el firmware/pantalla:

- Aceptar un payload de texto (o binario estructurado) con longitud acotada.
- Renderizar el texto en layout legible en e-ink.
- Definir fallback cuando el mensaje exceda el maximo permitido.

## Proximos pasos recomendados

Orden recomendado:

1. Implementar detector real de Windows usando `CapabilityAccessManager` y polling controlado.
2. Añadir controles manuales en la UI para forzar `busy` y `free` sin escenario predefinido.
3. Implementar tray app con menu minimo: conectar, desconectar, estado, salir.
4. Añadir pantalla o dialogo simple para configurar:
   - device address
   - characteristic UUID
   - payloads
5. Integrar pruebas de smoke con hardware real cuando exista el periferico disponible.
6. Implementar flujo end-to-end de mensaje personalizado:
   - UI de mensaje
   - API/endpoint de envio
   - comando en agente local
   - escritura BLE hacia la pantalla
   - confirmacion de entrega al usuario

## Riesgos y notas tecnicas

- En macOS no debe asumirse MAC address real; probablemente se necesitara un identificador logico de CoreBluetooth.
- La simulacion valida bien la logica, pero no valida timing ni compatibilidad real del stack BLE del sistema.
- `Tkinter` se usa porque viene con Python y evita meter una GUI pesada para el MVP.

## Si Claude Code retoma el trabajo

Objetivo inmediato sugerido para Claude Code:

- Implementar el detector real de Windows sin tocar el contrato del detector simulado.

Punto de extension previsto:

- Crear una implementacion concreta de `HardwareDetector` y usarla desde el servicio/orquestador sin romper CLI ni UI.

Regla de trabajo recomendada:

- Mantener el modo simulacion operativo en todo momento como entorno de regression manual.
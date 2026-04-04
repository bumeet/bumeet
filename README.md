# BUMEET Local Agent

Agente local multiplataforma en Python para detectar uso de camara o microfono y sincronizar el estado con un dispositivo BLE.

## Estructura inicial

- `src/bumeet_agent/app.py`: punto de entrada futuro
- `src/bumeet_agent/bootstrap.py`: inicializacion de servicios
- `src/bumeet_agent/config.py`: configuracion local
- `src/bumeet_agent/events/`: bus de eventos interno
- `src/bumeet_agent/domain/`: estados y reglas de negocio
- `src/bumeet_agent/ble/`: cliente GATT y protocolo de payloads
- `src/bumeet_agent/detection/`: deteccion de hardware por sistema operativo
- `src/bumeet_agent/tray/`: icono y menu de bandeja
- `src/bumeet_agent/storage/`: persistencia local
- `src/bumeet_agent/telemetry/`: puntos de extension para telemetria futura

## Requisitos

- Python 3.10+
- Windows 11 y macOS como objetivos prioritarios del MVP

## Estado

Repositorio inicializado con estructura base. Los modulos se iran implementando de forma iterativa.

## Simulacion sin hardware

Puedes ejecutar un flujo completo sin dispositivo BLE externo usando el modo simulacion:

```bash
PYTHONPATH=src python -m bumeet_agent.app --simulate --scenario default --delay-scale 0
```

Tambien puedes ver la simulacion en una interfaz de escritorio ligera:

```bash
PYTHONPATH=src python -m bumeet_agent.app --simulate-ui
```

Escenarios disponibles:

- `default`: llamada entra y termina
- `bounce`: varios cambios rapido busy/free
- `camera-only`: uso de camara sin microfono

Esto valida el flujo detector -> state machine -> BLE client fake -> eventos y logs sin depender de hardware real.

## Handoff para Claude Code

Hay una guia de traspaso lista para continuar el trabajo en:

- `docs/claude-code-handoff.md`

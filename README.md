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

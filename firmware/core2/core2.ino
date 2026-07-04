/**
 * BUMEET – Core2 BLE Status Display
 *
 * Displays FREE / BUSY status on the M5Stack Core2 LCD screen.
 * Receives text updates over BLE from the BUMEET desktop agent.
 *
 * Power management (mirrors the CoreInk firmware):
 *   - CPU 80 MHz activo / 10 MHz en idle (light sleep automático FreeRTOS tickless)
 *   - Conexión BLE persistente: interval 1000 ms, slave latency 0
 *   - Loop event-driven: bloquea en ulTaskNotifyTake hasta que llega un mensaje BLE,
 *     en vez de hacer polling con delay(100) — esto permite el light sleep.
 *   - Backlight LCD atenuado a los pocos segundos sin cambios (el LED de retro-
 *     iluminación domina el consumo: ~40-80 mA a brillo máximo).
 *
 * ─── BLE identifiers (same as CoreInk — agent config unchanged) ──────────────
 *   Device name:         BUMEET
 *   Service UUID:        a1b2c3d4-e5f6-7890-abcd-ef1234567891
 *   Characteristic UUID: a1b2c3d4-e5f6-7890-abcd-ef1234567892
 *
 * ─── Payload format (UTF-8, max 64 bytes) ────────────────────────────────────
 *   "FREE"
 *   "BUSY"
 *   "BUSY · Slack"
 *   "BUSY · Google Calendar · ends 15:30"
 *   "UPCOMING · Google Calendar · starts 15:00"
 *
 * ─── Arduino setup ───────────────────────────────────────────────────────────
 *   Board manager URL: https://m5stack.oss-cn-shenzhen.aliyuncs.com/resource/arduino/package_m5stack_index.json
 *   Board:     M5Stack-Core2
 *   Libraries: M5Unified  ·  NimBLE-Arduino  ·  Preferences (built-in)
 */

#include <M5Unified.h>
#include <NimBLEDevice.h>
#include <Preferences.h>
#include <WiFi.h>
#include <esp_pm.h>
#include <esp_bt.h>
#include <esp_task_wdt.h>

// ─── BLE identifiers ──────────────────────────────────────────────────────────
static const char* SVC_UUID  = "a1b2c3d4-e5f6-7890-abcd-ef1234567891";
static const char* CHAR_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567892";

// ─── Display constants (Core2: 320×240 LCD) ──────────────────────────────────
static const uint16_t SCREEN_W = 320;
static const uint16_t SCREEN_H = 240;

// ─── Power / BLE constants ────────────────────────────────────────────────────
static const uint8_t  CPU_FREQ_MHZ        = 80;
static const int8_t   BLE_TX_POWER        = ESP_PWR_LVL_N12;  // -12 dBm
static const uint16_t CONN_INTERVAL       = 800;   // × 1.25 ms = 1000 ms
static const uint16_t SLAVE_LATENCY       = 0;
static const uint16_t SUPERVISION_TIMEOUT = 400;   // × 10 ms  = 4000 ms
static const uint16_t ADV_INTERVAL        = 2048;  // × 0.625 ms = 1280 ms

// Brillo del backlight: alto al mostrar un cambio, atenuado en reposo.
static const uint8_t  BACKLIGHT_ACTIVE    = 80;    // de 255
static const uint8_t  BACKLIGHT_DIM       = 16;    // legible pero de bajo consumo
static const uint32_t BACKLIGHT_DIM_MS    = 15UL * 1000UL;   // atenuar a los 15 s
// Limpiar a FREE tras una desconexión prolongada (estado ya no fiable).
static const uint32_t AUTO_FREE_TIMEOUT_MS = 5UL * 60UL * 1000UL;
// Máximo bloqueo del loop (mantiene capacidad de respuesta del watchdog opcional).
static const uint32_t TASK_TIMEOUT_MS      = 60000;

// ─── Globals ──────────────────────────────────────────────────────────────────
static Preferences   gPrefs;
static String        gCurrentMsg;        // último estado mostrado (solo loop)
static String        gPendingMsg;        // recibido por BLE, pendiente de render
static String        gLastPersistedMsg;  // último valor escrito en NVS
static volatile bool gNeedsRedraw    = false;
static volatile bool gConnected      = false;
static unsigned long gDisconnectedMs = 0;
static unsigned long gLastRenderMs   = 0;
static bool          gBacklightDimmed = false;
static TaskHandle_t  gMainTask       = nullptr;
static portMUX_TYPE  gMsgMux         = portMUX_INITIALIZER_UNLOCKED;

// ─── Helpers ──────────────────────────────────────────────────────────────────

static int16_t centerX(const String& text, uint8_t textSize) {
    int16_t w = (int16_t)text.length() * 6 * (int16_t)textSize;
    int16_t x = (SCREEN_W - w) / 2;
    return x > 0 ? x : 0;
}

// Longitudes en BYTES de los separadores UTF-8: '·' (U+00B7) ocupa 2 bytes
// (0xC2 0xB7), así que " · " son 4 bytes — usar 3 dejaba un espacio inicial en
// source/detail y convertía la rama startsWith() en código muerto.
static const int SEP_LEN        = 4;   // " · "
static const int SEP_ENDS_LEN   = 9;   // " · ends "
static const int SEP_STARTS_LEN = 11;  // " · starts "

static void parsePayload(const String& msg,
                          String& header,
                          String& source,
                          String& detail) {
    header = "";
    source = "";
    detail = "";

    int sep1 = msg.indexOf(" · ");
    if (sep1 < 0) { header = msg; return; }

    header      = msg.substring(0, sep1);
    String rest = msg.substring(sep1 + SEP_LEN);

    int sep2 = rest.indexOf(" · ends ");
    if (sep2 >= 0) {
        source = rest.substring(0, sep2);
        detail = "ends " + rest.substring(sep2 + SEP_ENDS_LEN);
        return;
    }
    int sep3 = rest.indexOf(" · starts ");
    if (sep3 >= 0) {
        source = rest.substring(0, sep3);
        detail = "starts " + rest.substring(sep3 + SEP_STARTS_LEN);
        return;
    }
    if (rest.startsWith("ends ") || rest.startsWith("starts ")) {
        detail = rest;
    } else {
        source = rest;
    }
}

// ─── Rendering ────────────────────────────────────────────────────────────────

static void renderFree() {
    M5.Display.fillScreen(TFT_WHITE);
    M5.Display.setTextColor(TFT_BLACK, TFT_WHITE);
    M5.Display.setTextSize(6);
    M5.Display.setCursor(centerX("FREE", 6), 90);
    M5.Display.print("FREE");
    // No display() needed — Core2 LCD is immediate
}

static void renderBusy(const String& source, const String& endTime) {
    M5.Display.fillScreen(TFT_WHITE);

    // Black header band
    M5.Display.fillRect(0, 0, SCREEN_W, 80, TFT_BLACK);
    M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);
    M5.Display.setTextSize(6);
    M5.Display.setCursor(centerX("BUSY", 6), 12);
    M5.Display.print("BUSY");

    // Source and end-time
    M5.Display.setTextColor(TFT_BLACK, TFT_WHITE);
    int16_t yPos = 100;

    if (source.length() > 0) {
        M5.Display.setTextSize(3);
        M5.Display.setCursor(centerX(source, 3), yPos);
        M5.Display.print(source);
        yPos += 38;
    }

    if (endTime.length() > 0) {
        M5.Display.setTextSize(3);
        M5.Display.setCursor(centerX(endTime, 3), yPos);
        M5.Display.print(endTime);
    }
}

static void renderUpcoming(const String& source, const String& detail) {
    M5.Display.fillScreen(TFT_WHITE);

    // Banda oscura central, como en el CoreInk: reunión inminente, aún libre.
    M5.Display.fillRect(0, 60, SCREEN_W, 80, TFT_BLACK);
    M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);
    M5.Display.setTextSize(5);
    M5.Display.setCursor(centerX("SOON", 5), 82);
    M5.Display.print("SOON");

    M5.Display.setTextColor(TFT_BLACK, TFT_WHITE);
    int16_t yPos = 160;
    if (source.length() > 0) {
        M5.Display.setTextSize(3);
        M5.Display.setCursor(centerX(source, 3), yPos);
        M5.Display.print(source);
        yPos += 38;
    }
    if (detail.length() > 0) {
        M5.Display.setTextSize(3);
        M5.Display.setCursor(centerX(detail, 3), yPos);
        M5.Display.print(detail);
    }
}

static void renderMessage(const String& msg) {
    String header, source, detail;
    parsePayload(msg, header, source, detail);

    if (header == "BUSY") {
        renderBusy(source, detail);
    } else if (header == "UPCOMING") {
        // Antes UPCOMING caía en renderFree(): la pantalla decía FREE con una
        // reunión a punto de empezar — la señal exactamente contraria.
        renderUpcoming(source, detail);
    } else {
        renderFree();
    }
    // Subir el brillo al refrescar para que el cambio sea visible.
    M5.Display.setBrightness(BACKLIGHT_ACTIVE);
    gBacklightDimmed = false;
    gLastRenderMs    = millis();
}

// ─── BLE callbacks (static — sin asignación de heap) ──────────────────────────
class ServerCallbacks : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo) override {
        gConnected = true;
        // Negociar 1 s de intervalo para minimizar despertares de radio/CPU.
        pServer->updateConnParams(
            connInfo.getConnHandle(),
            CONN_INTERVAL, CONN_INTERVAL,
            SLAVE_LATENCY,
            SUPERVISION_TIMEOUT
        );
    }
    void onDisconnect(NimBLEServer*, NimBLEConnInfo&, int) override {
        // Timestamp ANTES del flag: si el loop viera gConnected=false con el
        // gDisconnectedMs de la desconexión anterior, dispararía el auto-FREE
        // al instante y borraría un BUSY legítimo.
        gDisconnectedMs = millis();
        gConnected      = false;
        NimBLEDevice::getAdvertising()->start();
        if (gMainTask) xTaskNotifyGive(gMainTask);  // recalcular timeout auto-FREE
    }
};

class WriteCallback : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* pC, NimBLEConnInfo&) override {
        std::string val = std::string(pC->getValue());
        if (val.size() == 0 || val.size() > 64) return;  // validar tamaño

        // Constructor con longitud explícita → binario-seguro (no trunca en NUL).
        String incoming(val.c_str(), val.size());
        incoming.trim();

        // No comparamos contra gCurrentMsg aquí (lo lee/escribe el loop en otro
        // task → data race). El loop deduplica de forma single-threaded.
        portENTER_CRITICAL(&gMsgMux);
        gPendingMsg  = incoming;
        gNeedsRedraw = true;
        portEXIT_CRITICAL(&gMsgMux);

        if (gMainTask) xTaskNotifyGive(gMainTask);
    }
};

static ServerCallbacks gServerCb;
static WriteCallback   gWriteCb;

// ─── Init helpers ─────────────────────────────────────────────────────────────
static void initPower() {
    WiFi.mode(WIFI_OFF);
    esp_bt_controller_mem_release(ESP_BT_MODE_CLASSIC_BT);

    // Light sleep automático: CPU baja a 10 MHz entre eventos BLE.
    esp_pm_config_esp32_t pmCfg = {
        .max_freq_mhz       = CPU_FREQ_MHZ,
        .min_freq_mhz       = 10,
        .light_sleep_enable = true,
    };
    esp_pm_configure(&pmCfg);
}

static void initBLE() {
    NimBLEDevice::init("BUMEET");
    NimBLEDevice::setPower(BLE_TX_POWER);

    NimBLEServer* pSrv = NimBLEDevice::createServer();
    pSrv->setCallbacks(&gServerCb);

    NimBLEService*        pSvc  = pSrv->createService(SVC_UUID);
    NimBLECharacteristic* pChar = pSvc->createCharacteristic(
        CHAR_UUID,
        NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
    );
    pChar->setCallbacks(&gWriteCb);
    pSvc->start();

    NimBLEAdvertising* pAdv = NimBLEDevice::getAdvertising();
    pAdv->addServiceUUID(SVC_UUID);
    pAdv->setName("BUMEET");
    pAdv->setMinInterval(ADV_INTERVAL);
    pAdv->setMaxInterval(ADV_INTERVAL);
    pAdv->start();
}

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
    setCpuFrequencyMhz(CPU_FREQ_MHZ);
    initPower();  // WiFi off + BT Classic off + light sleep — primero por los clocks

    auto cfg = M5.config();
    M5.begin(cfg);

    // Si el WDT del loop está activo en este build, no queremos que un bloqueo
    // largo en light sleep lo dispare. Desuscribir esta tarea es idempotente.
    esp_task_wdt_delete(NULL);

    M5.Display.setRotation(1);  // landscape

    // Restaurar último estado (partición NVS abierta una sola vez).
    gPrefs.begin("bumeet", false);
    String restored   = gPrefs.getString("msg", "FREE");
    gLastPersistedMsg = restored;
    renderMessage(restored);
    gCurrentMsg = restored;

    gMainTask = xTaskGetCurrentTaskHandle();
    initBLE();
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
void loop() {
    // Calcular el tiempo de espera hasta el próximo evento temporizado:
    //  - redraw pendiente            → no esperar
    //  - backlight aún sin atenuar   → despertar para atenuar
    //  - desconectado mostrando BUSY → despertar para limpiar a FREE
    //  - en reposo                   → bloquear hasta notificación (1 min máx)
    TickType_t waitTicks;
    {
        bool pending;
        portENTER_CRITICAL(&gMsgMux);
        pending = gNeedsRedraw;
        portEXIT_CRITICAL(&gMsgMux);

        if (pending) {
            waitTicks = 0;
        } else if (!gBacklightDimmed) {
            unsigned long elapsed = millis() - gLastRenderMs;
            uint32_t remaining = (elapsed < BACKLIGHT_DIM_MS)
                                    ? (BACKLIGHT_DIM_MS - (uint32_t)elapsed + 10) : 0;
            waitTicks = pdMS_TO_TICKS(remaining);
        } else if (!gConnected && gCurrentMsg != "FREE") {
            unsigned long sinceDisc = millis() - gDisconnectedMs;
            uint32_t remaining = (sinceDisc < AUTO_FREE_TIMEOUT_MS)
                                    ? (AUTO_FREE_TIMEOUT_MS - (uint32_t)sinceDisc + 10) : 0;
            waitTicks = pdMS_TO_TICKS(remaining);
        } else {
            waitTicks = pdMS_TO_TICKS(TASK_TIMEOUT_MS);
        }
    }

    if (waitTicks > 0) ulTaskNotifyTake(pdTRUE, waitTicks);

    M5.update();

    // ── Render del mensaje recibido ───────────────────────────────────────────
    String toRender;
    bool   needsRedraw = false;
    portENTER_CRITICAL(&gMsgMux);
    if (gNeedsRedraw) {
        toRender     = gPendingMsg;
        gNeedsRedraw = false;
        needsRedraw  = true;
    }
    portEXIT_CRITICAL(&gMsgMux);

    if (needsRedraw && toRender != gCurrentMsg) {
        renderMessage(toRender);   // sube brillo + resetea timers de backlight
        gCurrentMsg = toRender;
        if (toRender != gLastPersistedMsg) {
            gPrefs.putString("msg", toRender);  // persistir fuera del callback BLE
            gLastPersistedMsg = toRender;
        }
    }

    // ── Atenuar backlight tras inactividad ────────────────────────────────────
    if (!gBacklightDimmed && millis() - gLastRenderMs >= BACKLIGHT_DIM_MS) {
        M5.Display.setBrightness(BACKLIGHT_DIM);
        gBacklightDimmed = true;
    }

    // ── Auto-FREE tras desconexión prolongada ─────────────────────────────────
    // Encolar una vez (gPendingMsg != "FREE" evita re-disparos en bucle); el
    // propio loop la renderiza en la siguiente iteración (waitTicks = 0).
    if (!gConnected && gCurrentMsg != "FREE"
        && millis() - gDisconnectedMs >= AUTO_FREE_TIMEOUT_MS) {
        portENTER_CRITICAL(&gMsgMux);
        if (gPendingMsg != "FREE") {
            gPendingMsg  = "FREE";
            gNeedsRedraw = true;
        }
        portEXIT_CRITICAL(&gMsgMux);
    }
}

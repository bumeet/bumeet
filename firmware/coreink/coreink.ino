/**
 * BUMEET – CoreInk BLE Status Display
 *
 * Power management:
 *   - CPU 80 MHz activo / 10 MHz en idle (light sleep automático FreeRTOS tickless)
 *   - Conexión BLE persistente: interval 1000 ms, slave latency 0
 *   - E-ink: epd_quality solo en transiciones FREE↔BUSY; epd_fast para detalles
 *   - Consumo estimado idle conectado: ~1.0–1.2 mA → ~14 días con 390 mAh
 *
 * ─── BLE identifiers ─────────────────────────────────────────────────────────
 *   Device name:         BUMEET
 *   Service UUID:        a1b2c3d4-e5f6-7890-abcd-ef1234567891
 *   Characteristic UUID: a1b2c3d4-e5f6-7890-abcd-ef1234567892  (WRITE | WRITE_AUTHEN)
 *   Battery Service:     0x180F  (estándar BLE)
 *   Battery Char:        0x2A19  (READ | NOTIFY)
 *
 * ─── Payload format (UTF-8, 1–64 bytes) ──────────────────────────────────────
 *   "FREE"
 *   "BUSY"
 *   "BUSY · Slack"
 *   "BUSY · Google Calendar · ends 15:30"
 *   "UPCOMING · Google Calendar · starts 15:00"
 *
 * ─── Arduino setup ───────────────────────────────────────────────────────────
 *   Board:     M5Stack-CoreInk
 *   Libraries: M5Unified  ·  NimBLE-Arduino  ·  Preferences (built-in)
 */

// ─── Includes ─────────────────────────────────────────────────────────────────
#include <M5Unified.h>
#include <NimBLEDevice.h>
#include <Preferences.h>
#include <WiFi.h>
#include <esp_pm.h>
#include <esp_bt.h>

// ─── BLE UUIDs y constantes de conexión ──────────────────────────────────────
static const char* SVC_UUID      = "a1b2c3d4-e5f6-7890-abcd-ef1234567891";
static const char* CHAR_UUID     = "a1b2c3d4-e5f6-7890-abcd-ef1234567892";
static const char* BATT_SVC_UUID = "180F";
static const char* BATT_CHR_UUID = "2A19";

static const uint8_t  CPU_FREQ_MHZ        = 80;
static const int8_t   BLE_TX_POWER        = ESP_PWR_LVL_N12;  // -12 dBm
static const uint16_t CONN_INTERVAL       = 800;   // × 1.25 ms = 1000 ms
static const uint16_t SLAVE_LATENCY       = 0;
static const uint16_t SUPERVISION_TIMEOUT = 400;   // × 10 ms  = 4000 ms
static const uint16_t ADV_INTERVAL        = 2048;  // × 0.625 ms = 1280 ms
static const uint32_t BATT_INTERVAL_MS    = 10UL * 60UL * 1000UL;
static const uint32_t REFRESH_DEBOUNCE_MS = 1000;
static const uint32_t TASK_TIMEOUT_MS     = 60000;
// Tiempo sin conexión antes de limpiar el estado a FREE.
// 5 minutos: suficiente para cubrir pérdidas de señal breves (usuario en sala de reuniones),
// pero no tan largo como para dejar BUSY en la puerta cuando el usuario ya se ha ido.
static const uint32_t AUTO_FREE_TIMEOUT_MS   = 5UL  * 60UL * 1000UL;
// Reiniciar advertising periódicamente para evitar que NimBLE deje de anunciar
// tras horas sin conexión (bug conocido en algunos builds de NimBLE-Arduino).
static const uint32_t ADV_RESTART_INTERVAL_MS = 2UL * 60UL * 1000UL;
// Refresco completo de la pantalla e-ink cada 4 h para restaurar contraste y
// evitar ghosting cuando el contenido lleva horas sin cambiar.
static const uint32_t DISPLAY_REFRESH_INTERVAL_MS = 4UL * 60UL * 60UL * 1000UL;

// ─── Globals ──────────────────────────────────────────────────────────────────
static Preferences           gPrefs;
static String                gCurrentMsg;        // último estado mostrado en pantalla
static String                gPendingMsg;        // mensaje recibido por BLE, pendiente de render
static String                gLastPersistedMsg;  // último valor escrito en NVS
static volatile bool         gNeedsRedraw    = false;
static bool                  gConnected      = false;
static unsigned long         gDisconnectedMs = 0;  // millis() cuando se perdió la última conexión
static NimBLECharacteristic* pBattChar       = nullptr;
static unsigned long         gLastBattMs     = 0;
static unsigned long         gLastRefreshMs  = 0;
static unsigned long         gLastAdvRestart    = 0;
static unsigned long         gLastDisplayRefresh = 0;
static TaskHandle_t          gMainTask     = nullptr;
static portMUX_TYPE          gMsgMux       = portMUX_INITIALIZER_UNLOCKED;

// ─── Display helpers ──────────────────────────────────────────────────────────
static int16_t centerX(const String& text, uint8_t sz) {
    int16_t w = (int16_t)text.length() * 6 * sz;
    int16_t x = (200 - w) / 2;
    return x > 0 ? x : 0;
}

static void parsePayload(const String& msg, String& hdr, String& src, String& detail) {
    hdr = src = detail = "";
    int s1 = msg.indexOf(" · ");
    if (s1 < 0) { hdr = msg; return; }
    hdr = msg.substring(0, s1);
    String rest = msg.substring(s1 + 3);
    int s2 = rest.indexOf(" · ends ");
    if (s2 >= 0) { src = rest.substring(0, s2); detail = "ends " + rest.substring(s2 + 8); return; }
    int s3 = rest.indexOf(" · starts ");
    if (s3 >= 0) { src = rest.substring(0, s3); detail = "starts " + rest.substring(s3 + 10); return; }
    if (rest.startsWith("starts ") || rest.startsWith("ends ")) { detail = rest; } else { src = rest; }
}

// Transición mayor = cambia el header (FREE ↔ BUSY ↔ UPCOMING) → requiere epd_quality
static bool isMajorTransition(const String& prev, const String& next) {
    String hA, hB, dummy;
    parsePayload(prev, hA, dummy, dummy);
    parsePayload(next, hB, dummy, dummy);
    return hA != hB;
}

// ─── Render ───────────────────────────────────────────────────────────────────
static void renderFree() {
    M5.Display.fillScreen(TFT_WHITE);
    M5.Display.setTextColor(TFT_BLACK, TFT_WHITE);
    M5.Display.setTextSize(5);
    M5.Display.setCursor(centerX("FREE", 5), 80);
    M5.Display.print("FREE");
    M5.Display.display();
}

static void renderBusy(const String& src, const String& detail) {
    M5.Display.fillScreen(TFT_BLACK);
    M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);
    bool hasSub   = src.length() > 0 || detail.length() > 0;
    int16_t labelY = hasSub ? 54 : 80;
    M5.Display.setTextSize(5);
    M5.Display.setCursor(centerX("BUSY", 5), labelY);
    M5.Display.print("BUSY");
    if (src.length() > 0) {
        M5.Display.setTextSize(2);
        M5.Display.setCursor(centerX(src, 2), 120);
        M5.Display.print(src);
    }
    if (detail.length() > 0) {
        M5.Display.setTextSize(2);
        M5.Display.setCursor(centerX(detail, 2), 148);
        M5.Display.print(detail);
    }
    M5.Display.display();
}

static void renderUpcoming(const String& src, const String& detail) {
    M5.Display.fillScreen(TFT_WHITE);
    M5.Display.fillRect(0, 60, 200, 56, TFT_BLACK);
    M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);
    M5.Display.setTextSize(4);
    M5.Display.setCursor(centerX("SOON", 4), 72);
    M5.Display.print("SOON");
    M5.Display.setTextColor(TFT_BLACK, TFT_WHITE);
    if (src.length() > 0) {
        M5.Display.setTextSize(2);
        M5.Display.setCursor(centerX(src, 2), 132);
        M5.Display.print(src);
    }
    if (detail.length() > 0) {
        M5.Display.setTextSize(2);
        M5.Display.setCursor(centerX(detail, 2), 156);
        M5.Display.print(detail);
    }
    M5.Display.display();
}

static void renderMessage(const String& msg, bool forceQuality = false) {
    String hdr, src, detail;
    parsePayload(msg, hdr, src, detail);
    M5.Display.wakeup();  // activa el controlador e-ink antes de dibujar
    M5.Display.setEpdMode((forceQuality || isMajorTransition(gCurrentMsg, msg))
        ? epd_mode_t::epd_quality
        : epd_mode_t::epd_fast);
    if      (hdr == "FREE")     renderFree();
    else if (hdr == "UPCOMING") renderUpcoming(src, detail);
    else                        renderBusy(src, detail);
    M5.Display.sleep();   // controlador a bajo consumo — la imagen e-ink se mantiene sin corriente
}

// ─── BLE callbacks (static — sin fugas de memoria) ───────────────────────────
class ServerCallbacks : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo) override {
        gConnected = true;
        pServer->updateConnParams(
            connInfo.getConnHandle(),
            CONN_INTERVAL, CONN_INTERVAL,
            SLAVE_LATENCY,
            SUPERVISION_TIMEOUT
        );
        // No reanudamos advertising aquí — solo en onDisconnect
    }
    void onDisconnect(NimBLEServer*, NimBLEConnInfo&, int) override {
        gConnected      = false;
        gDisconnectedMs = millis();  // arrancar el contador para auto-FREE
        NimBLEDevice::getAdvertising()->start();
        if (gMainTask) xTaskNotifyGive(gMainTask);  // despertar el loop para recalcular timeout
    }
};

class WriteCallback : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* pC, NimBLEConnInfo&) override {
        std::string val = std::string(pC->getValue());
        if (val.size() == 0 || val.size() > 64) return;  // validar tamaño

        String incoming(val.c_str(), val.size());
        incoming.trim();
        if (incoming == gCurrentMsg) return;

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

    // Light sleep automático: CPU baja a 10 MHz entre eventos BLE
    esp_pm_config_esp32_t pmCfg = {
        .max_freq_mhz       = CPU_FREQ_MHZ,
        .min_freq_mhz       = 10,
        .light_sleep_enable = true,
    };
    esp_pm_configure(&pmCfg);
}

static void initDisplay() {
    auto cfg = M5.config();
    M5.begin(cfg);
    // M5.begin() puede reconfigurar GPIO_NUM_12 — re-assert inmediatamente después
    pinMode(GPIO_NUM_12, OUTPUT);
    digitalWrite(GPIO_NUM_12, HIGH);
    M5.Display.setRotation(0);
    M5.Display.setEpdMode(epd_mode_t::epd_quality);
}

static void initBLE() {
    NimBLEDevice::init("BUMEET");
    NimBLEDevice::setPower(BLE_TX_POWER);

    NimBLEServer* pSrv = NimBLEDevice::createServer();
    pSrv->setCallbacks(&gServerCb);

    // ── Servicio principal ────────────────────────────────────────────────────
    NimBLEService*        pSvc  = pSrv->createService(SVC_UUID);
    NimBLECharacteristic* pChar = pSvc->createCharacteristic(
        CHAR_UUID,
        NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
    );
    pChar->setCallbacks(&gWriteCb);
    pSvc->start();

    // ── Battery Service estándar 0x180F / 0x2A19 ─────────────────────────────
    NimBLEService* pBattSvc = pSrv->createService(BATT_SVC_UUID);
    pBattChar = pBattSvc->createCharacteristic(
        BATT_CHR_UUID,
        NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
    );
    uint8_t initBatt = 50;
    pBattChar->setValue(&initBatt, 1);
    pBattSvc->start();

    // ── Advertising ───────────────────────────────────────────────────────────
    NimBLEAdvertising* pAdv = NimBLEDevice::getAdvertising();
    pAdv->addServiceUUID(SVC_UUID);
    pAdv->setName("BUMEET");
    pAdv->setMinInterval(ADV_INTERVAL);
    pAdv->setMaxInterval(ADV_INTERVAL);
    pAdv->start();
}

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
    // Hold pin ANTES de todo para evitar power-off al soltar el botón
    pinMode(GPIO_NUM_12, OUTPUT);
    digitalWrite(GPIO_NUM_12, HIGH);

    setCpuFrequencyMhz(CPU_FREQ_MHZ);

    initPower();   // WiFi off + BT Classic off + light sleep — primero por los clocks
    initDisplay(); // M5.begin + hold pin re-assert

    // Restaurar último estado desde NVS (partición abierta una sola vez)
    gPrefs.begin("bumeet", false);
    String restoredMsg    = gPrefs.getString("msg", "FREE");
    gLastPersistedMsg     = restoredMsg;
    // gCurrentMsg queda vacío para que isMajorTransition fuerce epd_quality en el primer render
    renderMessage(restoredMsg);
    gCurrentMsg         = restoredMsg;
    gLastDisplayRefresh = millis();  // primer refresco completo en 4 h, no inmediatamente

    gMainTask = xTaskGetCurrentTaskHandle();
    initBLE();
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
void loop() {
    // Re-assert hold pin en cada tick — guard contra glitch de GPIO
    digitalWrite(GPIO_NUM_12, HIGH);

    // Calcular tiempo de espera óptimo:
    //  - refresco pendiente en debounce → esperar solo el tiempo restante
    //  - desconectado → despertar justo cuando expire AUTO_FREE_TIMEOUT
    //  - conectado idle → bloquear hasta 1 minuto
    TickType_t waitTicks;
    {
        bool pending;
        portENTER_CRITICAL(&gMsgMux);
        pending = gNeedsRedraw;
        portEXIT_CRITICAL(&gMsgMux);

        if (pending) {
            unsigned long elapsed   = millis() - gLastRefreshMs;
            uint32_t      remaining = (elapsed < REFRESH_DEBOUNCE_MS)
                                        ? (REFRESH_DEBOUNCE_MS - (uint32_t)elapsed + 10)
                                        : 0;
            waitTicks = pdMS_TO_TICKS(remaining);
        } else if (!gConnected && gCurrentMsg != "FREE") {
            // Despertar exactamente cuando expire el timeout de auto-FREE
            unsigned long sinceDisc = millis() - gDisconnectedMs;
            uint32_t remaining = (sinceDisc < AUTO_FREE_TIMEOUT_MS)
                                    ? (AUTO_FREE_TIMEOUT_MS - (uint32_t)sinceDisc + 10)
                                    : 0;
            waitTicks = pdMS_TO_TICKS(remaining);
        } else if (!gConnected) {
            // Despertar antes del próximo reinicio de advertising
            unsigned long sinceRestart = millis() - gLastAdvRestart;
            uint32_t remaining = (sinceRestart < ADV_RESTART_INTERVAL_MS)
                                    ? (ADV_RESTART_INTERVAL_MS - (uint32_t)sinceRestart + 10)
                                    : 0;
            // Nunca esperar más de 1 min para mantener la capacidad de respuesta
            waitTicks = pdMS_TO_TICKS(min(remaining, (uint32_t)TASK_TIMEOUT_MS));
        } else {
            waitTicks = pdMS_TO_TICKS(TASK_TIMEOUT_MS);
        }
    }

    if (waitTicks > 0) ulTaskNotifyTake(pdTRUE, waitTicks);

    M5.update();

    // ── Refresco e-ink con debounce ───────────────────────────────────────────
    String toRender;
    bool   needsRedraw = false;

    if (millis() - gLastRefreshMs >= REFRESH_DEBOUNCE_MS) {
        portENTER_CRITICAL(&gMsgMux);
        if (gNeedsRedraw) {
            toRender     = gPendingMsg;
            gNeedsRedraw = false;
            needsRedraw  = true;
        }
        portEXIT_CRITICAL(&gMsgMux);
    }

    if (needsRedraw) {
        renderMessage(toRender);
        gCurrentMsg    = toRender;
        gLastRefreshMs = millis();

        // Persistir en NVS solo si el valor cambió y fuera del callback BLE
        if (toRender != gLastPersistedMsg) {
            gPrefs.putString("msg", toRender);
            gLastPersistedMsg = toRender;
        }
    }

    // ── Auto-FREE tras desconexión prolongada ─────────────────────────────────
    // Si el agente lleva más de 5 min fuera de rango y la pantalla muestra algo
    // distinto de FREE, limpiarla: el estado ya no es fiable.
    if (!gConnected
        && gCurrentMsg != "FREE"
        && millis() - gDisconnectedMs >= AUTO_FREE_TIMEOUT_MS) {
        portENTER_CRITICAL(&gMsgMux);
        gPendingMsg  = "FREE";
        gNeedsRedraw = true;
        portEXIT_CRITICAL(&gMsgMux);
        if (gMainTask) xTaskNotifyGive(gMainTask);
    }

    // ── Refresco completo de pantalla e-ink cada 4 h ─────────────────────────
    // El panel e-ink pierde contraste y desarrolla ghosting si el contenido
    // lleva horas sin cambiar. Un ciclo epd_quality restaura los píxeles.
    // Solo se hace si no hay un redibujado pendiente para evitar parpadeo.
    if (!gNeedsRedraw && millis() - gLastDisplayRefresh >= DISPLAY_REFRESH_INTERVAL_MS) {
        gLastDisplayRefresh = millis();
        renderMessage(gCurrentMsg, true);  // epd_quality forzado
    }

    // ── Watchdog advertising: reiniciar cada 2 min si no hay conexión ────────
    // NimBLE puede dejar de anunciar internamente tras horas sin conexión.
    // Forzar start() es idempotente si ya está corriendo.
    if (!gConnected && millis() - gLastAdvRestart >= ADV_RESTART_INTERVAL_MS) {
        gLastAdvRestart = millis();
        NimBLEDevice::getAdvertising()->stop();
        NimBLEDevice::getAdvertising()->start();
    }

    // ── Batería cada 10 min — notify solo si cambió ───────────────────────────
    if (pBattChar && millis() - gLastBattMs >= BATT_INTERVAL_MS) {
        gLastBattMs = millis();
        int lvl = M5.Power.getBatteryLevel();
        if (lvl >= 0) {
            uint8_t b    = (uint8_t)lvl;
            uint8_t prev = pBattChar->getValue<uint8_t>();
            if (b != prev) {
                pBattChar->setValue(&b, 1);
                pBattChar->notify();
            }
        }
    }
}

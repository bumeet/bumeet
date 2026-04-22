/**
 * BUMEET – CoreInk BLE Status Display  (always-on edition)
 *
 * The device advertises continuously and maintains a persistent BLE connection
 * with the host agent. The agent pushes FREE/BUSY payloads in real time
 * (e.g. 5 s before a meeting or when the mic opens).
 *
 * Power budget (estimated on 390 mAh battery):
 *   BLE connected + light sleep: ~3–8 mA average → ~48–130 h
 *   E-ink only draws power during a refresh (~50 mA for ~1 s)
 *
 * ─── BLE identifiers ─────────────────────────────────────────────────────────
 *   Device name:         BUMEET
 *   Service UUID:        a1b2c3d4-e5f6-7890-abcd-ef1234567891
 *   Characteristic UUID: a1b2c3d4-e5f6-7890-abcd-ef1234567892
 *
 * ─── Payload format (UTF-8, max 64 bytes) ────────────────────────────────────
 *   "FREE"
 *   "BUSY"
 *   "BUSY · Slack"
 *   "BUSY · Google Calendar · ends 15:30"
 *
 * ─── Arduino setup ───────────────────────────────────────────────────────────
 *   Board:     M5Stack-CoreInk
 *   Libraries: M5Unified  ·  NimBLE-Arduino  ·  Preferences (built-in)
 */

#include <M5Unified.h>
#include <NimBLEDevice.h>
#include <Preferences.h>

// ─── BLE identifiers ──────────────────────────────────────────────────────────
static const char* SVC_UUID  = "a1b2c3d4-e5f6-7890-abcd-ef1234567891";
static const char* CHAR_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567892";
static const char* BATT_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567893";

// ─── Tuning ───────────────────────────────────────────────────────────────────
static const uint8_t  CPU_FREQ_MHZ     = 80;
static const int8_t   BLE_TX_POWER     = ESP_PWR_LVL_N12;  // -12 dBm, saves power
// Advertising interval: 500 ms (saves power vs 100 ms, still connects quickly)
static const uint16_t ADV_INTERVAL_MIN = 800;   // × 0.625 ms = 500 ms
static const uint16_t ADV_INTERVAL_MAX = 800;
// Connection interval requested: 500 ms (low power while connected)
static const uint16_t CONN_INTERVAL_MIN = 400;  // × 1.25 ms = 500 ms
static const uint16_t CONN_INTERVAL_MAX = 400;

// ─── Globals ──────────────────────────────────────────────────────────────────
static Preferences          gPrefs;
static String               gCurrentMsg;
static String               gPendingMsg;
static volatile bool        gNeedsRedraw   = false;
static bool                 gConnected     = false;
static NimBLECharacteristic* pBattChar     = nullptr;
static unsigned long         gLastBattMs   = 0;
static const uint32_t        BATT_INTERVAL = 60000UL;  // update every 60 s

// ─── Display helpers ──────────────────────────────────────────────────────────
static int16_t centerX(const String& text, uint8_t sz) {
    int16_t w = (int16_t)text.length() * 6 * sz;
    int16_t x = (200 - w) / 2;
    return x > 0 ? x : 0;
}

static void parsePayload(const String& msg, String& hdr, String& src, String& ends) {
    hdr = src = ends = "";
    int s1 = msg.indexOf(" · ");
    if (s1 < 0) { hdr = msg; return; }
    hdr = msg.substring(0, s1);
    String rest = msg.substring(s1 + 3);
    int s2 = rest.indexOf(" · ends ");
    if (s2 >= 0) {
        src  = rest.substring(0, s2);
        ends = "ends " + rest.substring(s2 + 8);
    } else if (rest.startsWith("ends ")) {
        ends = rest;
    } else {
        src = rest;
    }
}

static void renderFree() {
    M5.Display.fillScreen(TFT_WHITE);
    M5.Display.setTextColor(TFT_BLACK, TFT_WHITE);
    M5.Display.setTextSize(5);
    M5.Display.setCursor(centerX("FREE", 5), 76);
    M5.Display.print("FREE");
    M5.Display.display();
}

static void renderBusy(const String& src, const String& ends) {
    M5.Display.fillScreen(TFT_WHITE);
    M5.Display.fillRect(0, 0, 200, 58, TFT_BLACK);
    M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);
    M5.Display.setTextSize(5);
    M5.Display.setCursor(centerX("BUSY", 5), 9);
    M5.Display.print("BUSY");
    M5.Display.setTextColor(TFT_BLACK, TFT_WHITE);
    int16_t y = 74;
    if (src.length() > 0) {
        M5.Display.setTextSize(2);
        M5.Display.setCursor(centerX(src, 2), y);
        M5.Display.print(src);
        y += 26;
    }
    if (ends.length() > 0) {
        M5.Display.setTextSize(2);
        M5.Display.setCursor(centerX(ends, 2), y);
        M5.Display.print(ends);
    }
    M5.Display.display();
}

static void renderMessage(const String& msg) {
    String hdr, src, ends;
    parsePayload(msg, hdr, src, ends);
    if (hdr == "BUSY") renderBusy(src, ends); else renderFree();
}

// ─── BLE server callbacks ─────────────────────────────────────────────────────
class ServerCallbacks : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo) override {
        gConnected = true;
        // Request low-power connection parameters
        pServer->updateConnParams(connInfo.getConnHandle(),
                                  CONN_INTERVAL_MIN, CONN_INTERVAL_MAX, 0, 100);
        // Keep advertising so a second device can discover us (optional)
        NimBLEDevice::getAdvertising()->start();
    }

    void onDisconnect(NimBLEServer* pServer, NimBLEConnInfo&, int) override {
        gConnected = false;
        // Restart advertising immediately so the agent can reconnect
        NimBLEDevice::getAdvertising()->start();
    }
};

class WriteCallback : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* pC, NimBLEConnInfo&) override {
        std::string val = std::string(pC->getValue());
        if (val.empty()) return;

        String incoming(val.c_str());
        incoming.trim();
        if (incoming == gCurrentMsg) return;  // no change — skip e-ink refresh

        gPendingMsg  = incoming;
        gNeedsRedraw = true;

        // Persist so we survive a power cycle
        gPrefs.begin("bumeet", false);
        gPrefs.putString("msg", incoming);
        gPrefs.end();
    }
};

// ─── Setup ────────────────────────────────────────────────────────────────────
void setup() {
    setCpuFrequencyMhz(CPU_FREQ_MHZ);

    auto cfg = M5.config();
    M5.begin(cfg);
    M5.Display.setRotation(0);

    // Restore last known state from NVS
    gPrefs.begin("bumeet", true);
    gCurrentMsg = gPrefs.getString("msg", "FREE");
    gPrefs.end();
    renderMessage(gCurrentMsg);

    // ── NimBLE GATT server ────────────────────────────────────────────────────
    NimBLEDevice::init("BUMEET");
    NimBLEDevice::setPower(BLE_TX_POWER);

    NimBLEServer*         pSrv  = NimBLEDevice::createServer();
    pSrv->setCallbacks(new ServerCallbacks());

    NimBLEService*        pSvc  = pSrv->createService(SVC_UUID);
    NimBLECharacteristic* pChar = pSvc->createCharacteristic(
        CHAR_UUID,
        NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
    );
    pChar->setCallbacks(new WriteCallback());

    // Battery level: readable and notifiable (0–100 as single byte)
    pBattChar = pSvc->createCharacteristic(
        BATT_UUID,
        NIMBLE_PROPERTY::READ | NIMBLE_PROPERTY::NOTIFY
    );
    uint8_t initBatt = (uint8_t)M5.Power.getBatteryLevel();
    pBattChar->setValue(&initBatt, 1);

    pSvc->start();

    NimBLEAdvertising* pAdv = NimBLEDevice::getAdvertising();
    pAdv->addServiceUUID(SVC_UUID);
    pAdv->setName("BUMEET");
    pAdv->setMinInterval(ADV_INTERVAL_MIN);
    pAdv->setMaxInterval(ADV_INTERVAL_MAX);
    pAdv->start();
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
void loop() {
    if (gNeedsRedraw) {
        gNeedsRedraw = false;
        gCurrentMsg  = gPendingMsg;
        renderMessage(gCurrentMsg);
    }

    // Push battery level every 60 s (notify if connected, just update value otherwise)
    if (pBattChar && (millis() - gLastBattMs >= BATT_INTERVAL)) {
        gLastBattMs = millis();
        uint8_t batt = (uint8_t)M5.Power.getBatteryLevel();
        pBattChar->setValue(&batt, 1);
        if (gConnected) pBattChar->notify();
    }

    // Light sleep between iterations — keeps BLE alive, saves CPU power
    delay(50);
}

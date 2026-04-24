/**
 * BUMEET – CoreInk BLE Status Display
 *
 * Power management:
 *   - CPU 80 MHz (vs default 240 MHz) — ~66% less CPU power draw
 *   - BLE modem sleep between advertising windows (NimBLE-managed)
 *   - E-ink only draws power during refresh (~50 mA for ~1 s)
 *   - Estimated battery life on 390 mAh: 24–72 h
 *
 * ─── BLE identifiers ─────────────────────────────────────────────────────────
 *   Device name:         BUMEET
 *   Service UUID:        a1b2c3d4-e5f6-7890-abcd-ef1234567891
 *   Characteristic UUID: a1b2c3d4-e5f6-7890-abcd-ef1234567892
 *   Battery UUID:        a1b2c3d4-e5f6-7890-abcd-ef1234567893
 *
 * ─── Payload format (UTF-8, max 64 bytes) ────────────────────────────────────
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

#include <M5Unified.h>
#include <NimBLEDevice.h>
#include <Preferences.h>

// ─── BLE identifiers ──────────────────────────────────────────────────────────
static const char* SVC_UUID  = "a1b2c3d4-e5f6-7890-abcd-ef1234567891";
static const char* CHAR_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567892";
static const char* BATT_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567893";

// ─── Tuning ───────────────────────────────────────────────────────────────────
static const uint8_t  CPU_FREQ_MHZ     = 80;
static const int8_t   BLE_TX_POWER     = ESP_PWR_LVL_N12;  // -12 dBm
// Advertising interval: 500 ms (low power, still connects quickly)
static const uint16_t ADV_INTERVAL_MIN = 800;   // × 0.625 ms = 500 ms
static const uint16_t ADV_INTERVAL_MAX = 800;
// Connection interval: 500 ms (low power while connected)
static const uint16_t CONN_INTERVAL_MIN = 400;  // × 1.25 ms = 500 ms
static const uint16_t CONN_INTERVAL_MAX = 400;
static const uint32_t LOOP_DELAY_MS    = 50;

// ─── Globals ──────────────────────────────────────────────────────────────────
static Preferences           gPrefs;
static String                gCurrentMsg;
static String                gPendingMsg;
static volatile bool         gNeedsRedraw = false;
static bool                  gConnected   = false;
static NimBLECharacteristic* pBattChar    = nullptr;
static unsigned long         gLastBattMs  = 0;

// ─── Display helpers ──────────────────────────────────────────────────────────
static int16_t centerX(const String& text, uint8_t sz) {
    int16_t w = (int16_t)text.length() * 6 * sz;
    int16_t x = (200 - w) / 2;
    return x > 0 ? x : 0;
}

// Parse "HDR · SRC · ends HH:MM"  or  "HDR · SRC · starts HH:MM"
static void parsePayload(const String& msg, String& hdr, String& src, String& detail) {
    hdr = src = detail = "";
    int s1 = msg.indexOf(" · ");
    if (s1 < 0) { hdr = msg; return; }
    hdr = msg.substring(0, s1);
    String rest = msg.substring(s1 + 3);
    int s2 = rest.indexOf(" · ends ");
    if (s2 >= 0) {
        src    = rest.substring(0, s2);
        detail = "ends " + rest.substring(s2 + 8);
        return;
    }
    int s3 = rest.indexOf(" · starts ");
    if (s3 >= 0) {
        src    = rest.substring(0, s3);
        detail = "starts " + rest.substring(s3 + 10);
        return;
    }
    if (rest.startsWith("starts ")) {
        detail = rest;
    } else if (rest.startsWith("ends ")) {
        detail = rest;
    } else {
        src = rest;
    }
}

// ─── Screens ──────────────────────────────────────────────────────────────────

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
    bool hasSub = src.length() > 0 || detail.length() > 0;
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
    // Black bar with "SOON" in white — visually between FREE and BUSY
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

static void renderMessage(const String& msg) {
    String hdr, src, detail;
    parsePayload(msg, hdr, src, detail);
    if      (hdr == "FREE")     renderFree();
    else if (hdr == "UPCOMING") renderUpcoming(src, detail);
    else                        renderBusy(src, detail);  // BUSY or unknown
}

// ─── BLE server callbacks ─────────────────────────────────────────────────────
class ServerCallbacks : public NimBLEServerCallbacks {
    void onConnect(NimBLEServer* pServer, NimBLEConnInfo& connInfo) override {
        gConnected = true;
        pServer->updateConnParams(connInfo.getConnHandle(),
                                  CONN_INTERVAL_MIN, CONN_INTERVAL_MAX, 0, 100);
        NimBLEDevice::getAdvertising()->start();
    }

    void onDisconnect(NimBLEServer* pServer, NimBLEConnInfo&, int) override {
        gConnected = false;
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
    M5.Display.setEpdMode(epd_mode_t::epd_quality);  // full refresh — eliminates ghosting

    // Restore last known state from NVS so display is correct after power cycle
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

    pBattChar = pSvc->createCharacteristic(BATT_UUID, NIMBLE_PROPERTY::READ);
    uint8_t initBatt = 50;
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
    M5.update();

    if (gNeedsRedraw) {
        gNeedsRedraw = false;
        gCurrentMsg  = gPendingMsg;
        renderMessage(gCurrentMsg);
    }

    // Update battery level every 60 s
    if (pBattChar && millis() - gLastBattMs >= 60000UL) {
        gLastBattMs = millis();
        int lvl = M5.Power.getBatteryLevel();
        if (lvl >= 0) {
            uint8_t b = (uint8_t)lvl;
            pBattChar->setValue(&b, 1);
        }
    }

    delay(LOOP_DELAY_MS);
}

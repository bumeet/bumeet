/**
 * BUMEET – CoreInk BLE Status Display  (deep-sleep edition)
 *
 * Power cycle:
 *   boot/wake → advertise 20 s → deep sleep 10 min → repeat
 *   Average consumption: ~0.5 mAh/h → ~32 days on CoreInk 390 mAh battery
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

// ─── Tuning ───────────────────────────────────────────────────────────────────
static const uint8_t  CPU_FREQ_MHZ      = 80;
static const int8_t   BLE_TX_POWER      = ESP_PWR_LVL_N12;      // -12 dBm
static const uint16_t ADV_INTERVAL_MIN  = 160;                   // × 0.625 ms = 100 ms
static const uint16_t ADV_INTERVAL_MAX  = 160;
static const uint32_t ADV_WINDOW_MS     = 20000;                 // advertise 20 s per wake
static const uint64_t SLEEP_INTERVAL_US = 10ULL * 60 * 1000000; // sleep 10 min

// ─── RTC memory (survives deep sleep, cleared on power-off) ───────────────────
RTC_DATA_ATTR static char rtcMsg[65] = "";
RTC_DATA_ATTR static bool rtcBooted  = false;

// ─── Globals ──────────────────────────────────────────────────────────────────
static Preferences   gPrefs;
static String        gCurrentMsg;
static String        gPendingMsg;
static volatile bool gNeedsRedraw = false;
static uint32_t      gAdvStartMs  = 0;

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

// ─── Sleep ────────────────────────────────────────────────────────────────────
static void goToSleep() {
    NimBLEDevice::getAdvertising()->stop();
    NimBLEDevice::deinit(true);
    esp_sleep_enable_timer_wakeup(SLEEP_INTERVAL_US);
    esp_deep_sleep_start();
}

// ─── BLE callback ─────────────────────────────────────────────────────────────
class WriteCallback : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* pC, NimBLEConnInfo&) override {
        std::string val = std::string(pC->getValue());
        if (val.empty()) return;

        String incoming(val.c_str());
        incoming.trim();
        if (incoming == gCurrentMsg) return;   // no change — skip e-ink refresh

        gPendingMsg  = incoming;
        gNeedsRedraw = true;
        gAdvStartMs  = millis();  // reset sleep timer on write

        strncpy(rtcMsg, incoming.c_str(), 64);
        rtcMsg[64] = '\0';

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

    if (!rtcBooted) {
        // First power-on: restore from NVS and render
        rtcBooted = true;
        gPrefs.begin("bumeet", true);
        gCurrentMsg = gPrefs.getString("msg", "FREE");
        gPrefs.end();
        strncpy(rtcMsg, gCurrentMsg.c_str(), 64);
        renderMessage(gCurrentMsg);
    } else {
        // Wake from deep sleep: e-ink panel already shows correct content
        gCurrentMsg = String(rtcMsg);
    }

    // ── NimBLE GATT server ────────────────────────────────────────────────────
    NimBLEDevice::init("BUMEET");
    NimBLEDevice::setPower(BLE_TX_POWER);

    NimBLEServer*         pSrv  = NimBLEDevice::createServer();
    NimBLEService*        pSvc  = pSrv->createService(SVC_UUID);
    NimBLECharacteristic* pChar = pSvc->createCharacteristic(
        CHAR_UUID,
        NIMBLE_PROPERTY::WRITE | NIMBLE_PROPERTY::WRITE_NR
    );
    pChar->setCallbacks(new WriteCallback());
    pSvc->start();

    NimBLEAdvertising* pAdv = NimBLEDevice::getAdvertising();
    pAdv->addServiceUUID(SVC_UUID);
    pAdv->setMinInterval(ADV_INTERVAL_MIN);
    pAdv->setMaxInterval(ADV_INTERVAL_MAX);
    pAdv->start();

    gAdvStartMs = millis();
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
void loop() {
    if (gNeedsRedraw) {
        gNeedsRedraw = false;
        gCurrentMsg  = gPendingMsg;
        renderMessage(gCurrentMsg);
    }

    if (millis() - gAdvStartMs > ADV_WINDOW_MS) {
        goToSleep();
    }

    delay(100);
}

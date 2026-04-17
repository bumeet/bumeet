/**
 * BUMEET – CoreInk BLE Status Display
 *
 * Displays FREE / BUSY status on the M5Stack CoreInk e-paper screen.
 * Receives text updates over BLE from the BUMEET desktop agent.
 *
 * ─── BLE identifiers (copy these to the agent config) ────────────────────────
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
 * ─── Power optimisations ─────────────────────────────────────────────────────
 *   • CPU: 80 MHz  (default 240 MHz)
 *   • BLE TX power: −12 dBm  (desk range only)
 *   • BLE advertising interval: ~1280 ms  (maximum undirected)
 *   • E-ink refreshes only when the message changes
 *   • WiFi never started
 *
 * ─── Arduino setup ───────────────────────────────────────────────────────────
 *   Board manager URL: https://m5stack.oss-cn-shenzhen.aliyuncs.com/resource/arduino/package_m5stack_index.json
 *   Board:     M5Stack-CoreInk
 *   Libraries: M5Unified  ·  NimBLE-Arduino  ·  Preferences (built-in)
 */

#include <M5Unified.h>
#include <NimBLEDevice.h>
#include <Preferences.h>

// ─── BLE identifiers ──────────────────────────────────────────────────────────
static const char* SVC_UUID  = "a1b2c3d4-e5f6-7890-abcd-ef1234567891";
static const char* CHAR_UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567892";

// ─── Power constants ──────────────────────────────────────────────────────────
static const uint8_t  CPU_FREQ_MHZ     = 80;
static const int8_t   BLE_TX_POWER     = ESP_PWR_LVL_N12;  // -12 dBm
static const uint16_t ADV_INTERVAL_MIN = 2048;              // × 0.625 ms = 1280 ms
static const uint16_t ADV_INTERVAL_MAX = 2056;              // × 0.625 ms ≈ 1285 ms
static const uint16_t LOOP_DELAY_MS    = 100;

// ─── Globals ──────────────────────────────────────────────────────────────────
static Preferences gPrefs;
static String      gCurrentMsg;
static String      gPendingMsg;
static volatile bool gNeedsRedraw = false;

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Return x that centers `text` in the 200 px wide canvas for the given textSize.
// M5GFX default font: each char is 6×textSize pixels wide.
static int16_t centerX(const String& text, uint8_t textSize) {
    int16_t w = (int16_t)text.length() * 6 * (int16_t)textSize;
    int16_t x = (200 - w) / 2;
    return x > 0 ? x : 0;
}

// Parse "BUSY · Source · ends HH:mm" into parts.
static void parsePayload(const String& msg,
                          String& header,
                          String& source,
                          String& endTime) {
    header  = "";
    source  = "";
    endTime = "";

    int sep1 = msg.indexOf(" · ");
    if (sep1 < 0) {
        header = msg;
        return;
    }
    header      = msg.substring(0, sep1);
    String rest = msg.substring(sep1 + 3);

    int sep2 = rest.indexOf(" · ends ");
    if (sep2 >= 0) {
        source  = rest.substring(0, sep2);
        endTime = "ends " + rest.substring(sep2 + 8);
    } else if (rest.startsWith("ends ")) {
        endTime = rest;
    } else {
        source = rest;
    }
}

// ─── Rendering ────────────────────────────────────────────────────────────────

static void renderFree() {
    M5.Display.fillScreen(TFT_WHITE);
    M5.Display.setTextColor(TFT_BLACK, TFT_WHITE);
    M5.Display.setTextSize(5);
    M5.Display.setCursor(centerX("FREE", 5), 76);
    M5.Display.print("FREE");
    M5.Display.display();   // push buffer to e-ink panel
}

static void renderBusy(const String& source, const String& endTime) {
    M5.Display.fillScreen(TFT_WHITE);

    // Black header band
    M5.Display.fillRect(0, 0, 200, 58, TFT_BLACK);
    M5.Display.setTextColor(TFT_WHITE, TFT_BLACK);
    M5.Display.setTextSize(5);
    M5.Display.setCursor(centerX("BUSY", 5), 9);
    M5.Display.print("BUSY");

    // Source and end-time
    M5.Display.setTextColor(TFT_BLACK, TFT_WHITE);
    int16_t yPos = 74;

    if (source.length() > 0) {
        M5.Display.setTextSize(2);
        M5.Display.setCursor(centerX(source, 2), yPos);
        M5.Display.print(source);
        yPos += 26;
    }

    if (endTime.length() > 0) {
        M5.Display.setTextSize(2);
        M5.Display.setCursor(centerX(endTime, 2), yPos);
        M5.Display.print(endTime);
    }

    M5.Display.display();
}

static void renderMessage(const String& msg) {
    String header, source, endTime;
    parsePayload(msg, header, source, endTime);

    if (header == "BUSY") {
        renderBusy(source, endTime);
    } else {
        renderFree();
    }
}

// ─── BLE callback ─────────────────────────────────────────────────────────────
class WriteCallback : public NimBLECharacteristicCallbacks {
    void onWrite(NimBLECharacteristic* pC, NimBLEConnInfo& connInfo) override {
        std::string val = std::string(pC->getValue());
        if (val.empty()) return;

        String incoming(val.c_str());
        incoming.trim();

        if (incoming == gCurrentMsg) return;   // no change — skip e-ink refresh

        gPendingMsg  = incoming;
        gNeedsRedraw = true;

        // Persist so the last state survives a reboot / power cycle
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

    // Restore and show last saved message
    gPrefs.begin("bumeet", true);
    gCurrentMsg = gPrefs.getString("msg", "FREE");
    gPrefs.end();
    renderMessage(gCurrentMsg);

    // ── NimBLE GATT server ────────────────────────────────────────────────────
    NimBLEDevice::init("BUMEET");
    NimBLEDevice::setPower(BLE_TX_POWER);

    NimBLEServer*  pSrv  = NimBLEDevice::createServer();
    NimBLEService* pSvc  = pSrv->createService(SVC_UUID);

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
}

// ─── Loop ─────────────────────────────────────────────────────────────────────
void loop() {
    if (gNeedsRedraw) {
        gNeedsRedraw = false;
        gCurrentMsg  = gPendingMsg;
        renderMessage(gCurrentMsg);
    }
    delay(LOOP_DELAY_MS);
}

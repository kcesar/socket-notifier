/* WiFi station Example

   This example code is in the Public Domain (or CC0 licensed, at your option.)

   Unless required by applicable law or agreed to in writing, this
   software is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR
   CONDITIONS OF ANY KIND, either express or implied.
*/
#include "esp_event.h"
#include "esp_log.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include "freertos/task.h"
#include "nvs_flash.h"
#include <string.h>

#include "lwip/err.h"
#include "lwip/sys.h"

#include "button.h"
#include "logging.h"
#include "speaker.h"
#include "websocket.h"
#include "wifi.h"
#include "configuration.h"
#include "ota.h"
#include "led.h"

static const char *TAG = "app";
/* The examples use WiFi configuration that you can set via project configuration menu

   If you'd rather not, just change the below entries to strings with
   the config you want - ie #define EXAMPLE_WIFI_SSID "mywifissid"
*/

#define EXAMPLE_ESP_WIFI_SSID "Misconfigured"
#define EXAMPLE_ESP_WIFI_PASS "pda_rulez!"

TaskHandle_t beep_handle = NULL;

void app_main(void) {
  speaker_setup();
  
  // Initialize NVS
  esp_err_t ret = nvs_flash_init();
  if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    ret = nvs_flash_init();
  }
  ESP_ERROR_CHECK(ret);

  char otaHash[OTA_HASH_STR_LEN];
  ESP_LOGI(TAG, "Starting firmware version %s", ota_get_partition_hash(otaHash));
  enable_logging();
  struct AppConfig *config = config_read();

  xTaskCreatePinnedToCore(led_task, "led", 2560, NULL, 15, NULL, 1);

  if (config != NULL) {
    wifi_init_sta(config->wifi_ssid, config->wifi_password);
    websocket_start(config->server, config->callsign);
    xTaskCreatePinnedToCore(speaker_task, "beep", 2560, NULL, 10, &beep_handle, 1);
  } else {
    ESP_LOGW(TAG, "Network not started: Wi-Fi not configured.");
    led_show("-1 FF0000 0 FF0000 200 000000 0 000000 1000");
  }

  xTaskCreatePinnedToCore(button_task, "button", 2560, NULL, 15, NULL, 1);
  xTaskCreatePinnedToCore(configure_task, "configure", 2560, NULL, 15, NULL, 1);
}
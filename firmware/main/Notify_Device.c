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

#include "logging.h"
#include "speaker.h"
#include "websocket.h"
#include "wifi.h"

static const char *TAG = "app";
/* The examples use WiFi configuration that you can set via project configuration menu

   If you'd rather not, just change the below entries to strings with
   the config you want - ie #define EXAMPLE_WIFI_SSID "mywifissid"
*/

#define EXAMPLE_ESP_WIFI_SSID "Misconfigured"
#define EXAMPLE_ESP_WIFI_PASS "pda_rulez!"

TaskHandle_t beep_handle = NULL;

void app_main(void) {
  // Initialize NVS
  esp_err_t ret = nvs_flash_init();
  if (ret == ESP_ERR_NVS_NO_FREE_PAGES || ret == ESP_ERR_NVS_NEW_VERSION_FOUND) {
    ESP_ERROR_CHECK(nvs_flash_erase());
    ret = nvs_flash_init();
  }
  ESP_ERROR_CHECK(ret);

  enable_logging();

  ESP_LOGI(TAG, "ESP_WIFI_MODE_STA");
  wifi_init_sta(EXAMPLE_ESP_WIFI_SSID, EXAMPLE_ESP_WIFI_PASS);
  websocket_start();
  xTaskCreatePinnedToCore(speaker_task, "beep", 2560, NULL, 10, &beep_handle, 1);
}
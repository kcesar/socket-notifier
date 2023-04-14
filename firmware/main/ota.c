#include <string.h>
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "esp_system.h"
#include "esp_log.h"
#include "esp_ota_ops.h"
#include "esp_https_ota.h"

#include "configuration.h"
#include "ota.h"

static const char *TAG = "OTA";

const char* ota_get_partition_hash(char outBuf[OTA_HASH_STR_LEN]) {
  uint8_t sha_256[OTA_HASH_LEN] = { 0 };
  esp_partition_get_sha256(esp_ota_get_running_partition(), sha_256);
  for (int i = 0; i < OTA_HASH_LEN; ++i) {
      sprintf(&outBuf[i * 2], "%02x", sha_256[i]);
  }
  outBuf[OTA_HASH_LEN * 2] = 0;
  return outBuf;
}

static esp_err_t http_event_handler(esp_http_client_event_t *evt)
{
    switch (evt->event_id) {
    case HTTP_EVENT_ERROR:
        ESP_LOGD(TAG, "HTTP_EVENT_ERROR");
        break;
    case HTTP_EVENT_ON_CONNECTED:
        ESP_LOGD(TAG, "HTTP_EVENT_ON_CONNECTED");
        break;
    case HTTP_EVENT_HEADER_SENT:
        ESP_LOGD(TAG, "HTTP_EVENT_HEADER_SENT");
        break;
    case HTTP_EVENT_ON_HEADER:
        ESP_LOGD(TAG, "HTTP_EVENT_ON_HEADER, key=%s, value=%s", evt->header_key, evt->header_value);
        break;
    case HTTP_EVENT_ON_DATA:
        ESP_LOGD(TAG, "HTTP_EVENT_ON_DATA, len=%d", evt->data_len);
        break;
    case HTTP_EVENT_ON_FINISH:
        ESP_LOGD(TAG, "HTTP_EVENT_ON_FINISH");
        break;
    case HTTP_EVENT_DISCONNECTED:
        ESP_LOGD(TAG, "HTTP_EVENT_DISCONNECTED");
        break;
    }
    return ESP_OK;
}

void ota_start_update() {
  ESP_LOGI(TAG, "Starting OTA update ...");

  struct AppConfig *config = config_read();
  const char *uriTemplate = "https://%s/api/devices/%s/firmware";
  char uri[strlen(uriTemplate) + strlen(config->server) + strlen(config->callsign)];
  sprintf(uri, uriTemplate, config->server, config->callsign);
  ESP_LOGI(TAG, "Downloading from %s", uri);
  esp_http_client_config_t otaConfig = {
    .url = uri,
    .event_handler = http_event_handler,
    .keep_alive_enable = true,
  };

  esp_err_t ret = esp_https_ota(&otaConfig);
  if (ret == ESP_OK) {
      ESP_LOGI(TAG, "OTA Succeed, Rebooting...");
      esp_restart();
  } else {
      ESP_LOGE(TAG, "Firmware upgrade failed");
  }
  while (1) {
      vTaskDelay(1000 / portTICK_PERIOD_MS);
  }
}
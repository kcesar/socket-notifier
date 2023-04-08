#include "esp_log.h"
#include "esp_system.h"
#include "esp_wifi.h"
#include "freertos/FreeRTOS.h"
#include "freertos/event_groups.h"
#include <string.h>

#include "wifi.h"

#define EXAMPLE_ESP_MAXIMUM_RETRY 10

/* FreeRTOS event group to signal when we are connected*/
static EventGroupHandle_t s_wifi_event_group;

/* The event group allows multiple bits for each event, but we only care about two events:
 * - we are connected to the AP with an IP
 * - we failed to connect after the maximum amount of retries */
#define WIFI_CONNECTED_BIT BIT0
#define WIFI_FAIL_BIT BIT1

static const char *TAG = "NETWORK";

static int s_retry_num = 0;
static SemaphoreHandle_t s_semph_get_ip_addrs = NULL;
static bool is_connected = false;

static void event_handler(void *arg, esp_event_base_t event_base,
                          int32_t event_id, void *event_data) {
  if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_START) {
    esp_wifi_connect();
  } else if (event_base == WIFI_EVENT && event_id == WIFI_EVENT_STA_DISCONNECTED) {
    if (s_retry_num < EXAMPLE_ESP_MAXIMUM_RETRY) {
      esp_wifi_connect();
      s_retry_num++;
      ESP_LOGI(TAG, "retry to connect to the AP");
    } else {
      xEventGroupSetBits(s_wifi_event_group, WIFI_FAIL_BIT);
      is_connected = false;
      if (s_semph_get_ip_addrs) {
        xSemaphoreGive(s_semph_get_ip_addrs);
      }
    }
    ESP_LOGW(TAG, "Failed to connect to network.");
  } else if (event_base == IP_EVENT && event_id == IP_EVENT_STA_GOT_IP) {
    ip_event_got_ip_t *event = (ip_event_got_ip_t *)event_data;
    ESP_LOGW(TAG, "Connected to network. IP:" IPSTR, IP2STR(&event->ip_info.ip));
    s_retry_num = 0;
    is_connected = true;
    if (s_semph_get_ip_addrs) {
      xSemaphoreGive(s_semph_get_ip_addrs);
    }
    xEventGroupSetBits(s_wifi_event_group, WIFI_CONNECTED_BIT);
  }
}

bool wait_for_ip() {
  xSemaphoreTake(s_semph_get_ip_addrs, portMAX_DELAY);
  return is_connected;
}

void wifi_init_sta(const char *ssid, const char *password) {
  ESP_LOGW(TAG, "Connecting to wireless network (%s) ...", ssid);
  s_semph_get_ip_addrs = xSemaphoreCreateBinary();
  s_wifi_event_group = xEventGroupCreate();

  ESP_ERROR_CHECK(esp_netif_init());

  ESP_ERROR_CHECK(esp_event_loop_create_default());
  esp_netif_create_default_wifi_sta();

  wifi_init_config_t cfg = WIFI_INIT_CONFIG_DEFAULT();
  ESP_ERROR_CHECK(esp_wifi_init(&cfg));

  esp_event_handler_instance_t instance_any_id;
  esp_event_handler_instance_t instance_got_ip;
  ESP_ERROR_CHECK(esp_event_handler_instance_register(WIFI_EVENT,
                                                      ESP_EVENT_ANY_ID,
                                                      &event_handler,
                                                      NULL,
                                                      &instance_any_id));
  ESP_ERROR_CHECK(esp_event_handler_instance_register(IP_EVENT,
                                                      IP_EVENT_STA_GOT_IP,
                                                      &event_handler,
                                                      NULL,
                                                      &instance_got_ip));

  wifi_config_t wifi_config = {
      .sta = {
          /* Setting a password implies station will connect to all security modes including WEP/WPA.
           * However these modes are deprecated and not advisable to be used. Incase your Access point
           * doesn't support WPA2, these mode can be enabled by commenting below line */
          .threshold = {
              .authmode = WIFI_AUTH_WPA2_PSK,
          },
      },
  };
  strcpy((char *)wifi_config.sta.ssid, ssid);
  strcpy((char *)wifi_config.sta.password, password);
  ESP_ERROR_CHECK(esp_wifi_set_mode(WIFI_MODE_STA));
  ESP_ERROR_CHECK(esp_wifi_set_config(WIFI_IF_STA, &wifi_config));
  ESP_ERROR_CHECK(esp_wifi_start());

  ESP_LOGI(TAG, "wifi_init_sta finished.");
}
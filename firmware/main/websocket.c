#include "esp_log.h"
#include "esp_websocket_client.h"

#include "speaker.h"
#include "websocket.h"
#include "wifi.h"

static const char *TAG = "WEBSOCKET";

static char* serverName = NULL;
static char* callsign = NULL;

static void handle_websocket_message(char *message) {
  char *marker;
  const char *command = strtok_r(message, " ", &marker);
  ESP_LOGI(TAG, "SOCKET MESSAGE %s (%s)", command, marker);
  if (strcmp(command, "WELCOME") == 0) {
    ESP_LOGW(TAG, "Successfully connected to %s as %s", serverName, callsign);
  } else if (strcmp(command, "LED") == 0) {
    ESP_LOGI(TAG, "An LED message");
  } else if (strcmp(command, "BEEP") == 0) {
    ESP_LOGI(TAG, "A BEEP message %s", marker);
    int speakerId = atoi(strtok_r(NULL, " ", &marker));
    if (speakerId == 1) speaker_play(marker);
  }
}

static void websocket_event_handler(void *handler_args, esp_event_base_t base, int32_t event_id, void *event_data) {
  esp_websocket_event_data_t *data = (esp_websocket_event_data_t *)event_data;
  char outBuf[32];
  ESP_LOGI(TAG, "WEBSOCKET event event=%d opcode=%d len=%d", event_id, data ? data->op_code : -5, data->data_len);
  if (event_id == WEBSOCKET_EVENT_CONNECTED) {
    ESP_LOGI(TAG, "WEBSOCKET_EVENT_CONNECTED");
    int len = sprintf(outBuf, "HELLO %s", callsign);
    esp_websocket_client_send_text(data->client, outBuf, len, portMAX_DELAY);
  } else if (event_id == WEBSOCKET_EVENT_DISCONNECTED) {
    ESP_LOGI(TAG, "WEBSOCKET_EVENT_DISCONNECTED");
  } else if (event_id == WEBSOCKET_EVENT_DATA && data->op_code == 1) {
    char buffer[data->data_len + 1];
    strncpy(buffer, data->data_ptr, data->data_len);
    buffer[data->data_len] = 0;
    handle_websocket_message(buffer);
  } else if (event_id == WEBSOCKET_EVENT_DATA) {
    if (data->op_code == 0x08 && data->data_len == 2) {
      ESP_LOGW(TAG, "Received closed message with code=%d", 256 * data->data_ptr[0] + data->data_ptr[1]);
    } else if (data->op_code == 9 || data->op_code == 10) {
      // ignore ping messages
    } else {
      ESP_LOGW(TAG, "Received=%.*s", data->data_len, (char *)data->data_ptr);
    }
  } else if (event_id == WEBSOCKET_EVENT_ERROR) {
    ESP_LOGI(TAG, "WEBSOCKET_EVENT_ERROR");
  }
}

void websocket_start(char *server, char *configCallsign) {
  ESP_LOGI(TAG, "Starting websocket");

  if (!wait_for_ip()) {
    ESP_LOGE(TAG, "Couldn't get IP. aborting");
    return;
  }

  serverName = server;
  callsign = configCallsign;

  ESP_LOGI(TAG, "have ip. starting websocket connection to %s", server);
  const char *uriTemplate = "wss://%s/ws";
  char uri[strlen(server) + strlen(uriTemplate)];
  sprintf(uri, uriTemplate, server);

  esp_websocket_client_config_t config = {
      .uri = uri,
  };

  esp_websocket_client_handle_t client = esp_websocket_client_init(&config);
  esp_websocket_register_events(client, WEBSOCKET_EVENT_ANY, websocket_event_handler, (void *)client);

  esp_websocket_client_start(client);
}
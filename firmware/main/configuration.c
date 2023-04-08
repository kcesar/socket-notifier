#include "driver/uart.h"
#include "esp_log.h"
#include "esp_vfs.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "nvs.h"
#include "nvs_flash.h"
#include <string.h>

#include "logging.h"
#include "configuration.h"

#define MAX_INPUT_LEN 64
#define NVS_NAMESPACE "config"
#define NVS_KEY_SSID "wifi_ssid"
#define NVS_KEY_PASSWORD "wifi_password"
#define NVS_KEY_SERVER "server"
#define NVS_KEY_CALLSIGN "callsign"

#define DEFAULT_SERVER "notifier.kcesar.org"

enum ConfigState_t {
  IDLE,
  WIFI_PROMPT,
  PASSWORD_PROMPT,
  SERVER_PROMPT,
  CALLSIGN_PROMPT,
  REVIEW,
  RESTART,
};

static const char *TAG = "CONFIG";

static struct AppConfig *loadedConfig = NULL;
struct AppConfig *editConfig = NULL;
static enum ConfigState_t config_state = IDLE;
static char user_input[MAX_INPUT_LEN];
static int user_idx = 0;
static bool restartOnCancel = false;

char* stringOrEmpty(char* str) {
  if (str == NULL) return "";
  return str;
}

void printPrompt() {
  if (config_state == IDLE) return;

  if (config_state == WIFI_PROMPT) {
    printf("1/4 Enter Wi-Fi Name:\n[%s]", stringOrEmpty(editConfig->wifi_ssid));
  } else if (config_state == PASSWORD_PROMPT) {
    printf("2/4 Enter Wi-Fi Password:\n[*******]");
  } else if (config_state == SERVER_PROMPT) {
    printf("3/4 Enter server name:\n[%s]", stringOrEmpty(editConfig->server));
  } else if (config_state == CALLSIGN_PROMPT) {
    printf("4/4 Enter call sign:\n[%s]", stringOrEmpty(editConfig->callsign));
  } else if (config_state == REVIEW) {
    printf("\nIs this correct? Press ENTER to commit these changes. ESC to cancel.\n\n");
    printf("SSID: %s\nPassword: [hidden]\nServer: %s\nCall sign: %s\n\n", editConfig->wifi_ssid, editConfig->server, editConfig->callsign);
    printf("[ENTER/ESC]");
  }
  putchar(' ');
  putchar('>');
  putchar(' ');
  fsync(fileno(stdout));
}

void copyToField(char** field, char* value) {  
  if (*field != NULL) {
    free(*field);
  }

  *field = malloc(strlen(value) + 1);
  strcpy(*field, value);
}
void setupEditConfig() {
  if (editConfig != NULL) free(editConfig);

  editConfig = (struct AppConfig *)malloc(sizeof(struct AppConfig));
  memset(editConfig, 0, sizeof(struct AppConfig));
  copyToField(&editConfig->server, DEFAULT_SERVER);
  if (loadedConfig != NULL) {
    editConfig->wifi_ssid = loadedConfig->wifi_ssid;
    editConfig->wifi_password = loadedConfig->wifi_password;
    editConfig->server = loadedConfig->server;
    editConfig->callsign = loadedConfig->callsign;
  }
}

void start_set_config() {
  disable_logging();
  setupEditConfig();

  printf("======= CONFIGURATION =======\n");
  printf("(ESC to cancel)\n");
  config_state = WIFI_PROMPT;
  printPrompt();
}

void endSetConfig(bool commit) {
  config_state = IDLE;
  enable_logging();
  if (commit) {
    nvs_handle_t my_handle;
    esp_err_t err = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &my_handle);
    if (err != ESP_OK) {
      ESP_LOGE(TAG, "Failed to open device storage");
    } else {
      nvs_set_str(my_handle, NVS_KEY_SSID, editConfig->wifi_ssid);
      nvs_set_str(my_handle, NVS_KEY_PASSWORD, editConfig->wifi_password);
      nvs_set_str(my_handle, NVS_KEY_SERVER, editConfig->server);
      nvs_set_str(my_handle, NVS_KEY_CALLSIGN, editConfig->callsign);
      nvs_commit(my_handle);
      nvs_close(my_handle);
      ESP_LOGW(TAG, "Settings changed. Restart ...");
      esp_restart();
    }
  } else {
    ESP_LOGW(TAG, "Cencelled setup.");
    if (restartOnCancel) {
      ESP_LOGW(TAG, "System is missing configuration. Restarting ...");
      esp_restart();
    }
  }
  free(editConfig);
}

void handleBasicInput(char** field, enum ConfigState_t nextState) {
  if (user_idx == 0 && field == NULL) {
    // do nothing. User needs to repeat the last step.
  } else {
    if (user_idx > 0) {
      copyToField(field, user_input);
    }
    config_state = nextState;
  }
  printPrompt();
}

void handleUserInput() {
  if (config_state == IDLE) return;
  
  if (config_state == WIFI_PROMPT) {
    handleBasicInput(&editConfig->wifi_ssid, PASSWORD_PROMPT);
  } else if (config_state == PASSWORD_PROMPT) {
    handleBasicInput(&editConfig->wifi_password, SERVER_PROMPT);
  } else if (config_state == SERVER_PROMPT) {
    handleBasicInput(&editConfig->server, CALLSIGN_PROMPT);
  } else if (config_state == CALLSIGN_PROMPT) {
    handleBasicInput(&editConfig->callsign, REVIEW);
  } else if (config_state == REVIEW) {
    endSetConfig(true);
  }
}

void configure_task(void *args) {
  if (config_read() == NULL) {
    restartOnCancel = true;
    start_set_config();
  }
  
  while (1) {
    if (config_state == IDLE) {
      char c = getchar();
      if (c == 10) {
        start_set_config();
      }
      vTaskDelay(500 / portTICK_PERIOD_MS);
    } else {
      char c = getchar();
      if (c == 0 || c == 255) {
        // wait for more input
        vTaskDelay(50 / portTICK_PERIOD_MS);
      } else if (c == '\r') {
        // do nothing
      } else {
        if (c == 27) {          
          putchar('\n');
          endSetConfig(false);
        } else if (c == '\n') {
          user_input[user_idx] = 0;
          putchar('\n');
          putchar('\n');
          handleUserInput(c);
          user_idx = 0;
        } else if (c == '\b') {
          if (user_idx > 0) {
            putchar('\b');
            putchar(' ');
            putchar('\b');
            user_input[user_idx] = 0;
            user_idx--;
          }
        } else if (c > 20 && c < 128) {
          user_input[user_idx] = c;
          if (user_idx < MAX_INPUT_LEN) {
            user_idx++;
            user_input[user_idx] = 0;
          } else {
            putchar('\b');
          }
          putchar(c);
        }
        fsync(fileno(stdout));
      }
    }
  }
}

esp_err_t read_string(nvs_handle_t handle, const char* key, char** field) {
  size_t size;
  esp_err_t err = nvs_get_str(handle, key, NULL, &size);
  if (err != ESP_OK) return err;

  char* value = malloc(size);
  err = nvs_get_str(handle, key, value, &size);
  if (err != ESP_OK) return err;

  *field = value;
  return ESP_OK;
}

struct AppConfig* config_read() {
  if (loadedConfig == NULL) {
    struct AppConfig *newConfig = (struct AppConfig *)malloc(sizeof(struct AppConfig));
    nvs_handle_t my_handle;
    esp_err_t err = nvs_open(NVS_NAMESPACE, NVS_READWRITE, &my_handle);
    if (err != ESP_OK) {
      ESP_LOGE(TAG, "Error (%s) opening NVS handle!\n", esp_err_to_name(err));
      nvs_close(my_handle);
      return NULL;
    } else {
      err = read_string(my_handle, NVS_KEY_SSID, &newConfig->wifi_ssid);
      if (err != ESP_OK) {
        ESP_LOGW(TAG, "Configuration missing");
        return NULL;
      }

      err = read_string(my_handle, NVS_KEY_PASSWORD, &newConfig->wifi_password);
      if (err != ESP_OK) {
        ESP_LOGW(TAG, "Configuration missing");
        return NULL;
      }

      err = read_string(my_handle, NVS_KEY_SERVER, &newConfig->server);
      if (err != ESP_OK) {
        ESP_LOGW(TAG, "Configuration missing");
        return NULL;
      }

      err = read_string(my_handle, NVS_KEY_CALLSIGN, &newConfig->callsign);
      if (err != ESP_OK) {
        ESP_LOGW(TAG, "Configuration missing");
        return NULL;
      }

      nvs_close(my_handle);
      loadedConfig = newConfig;
    }
  }
  return loadedConfig;
}
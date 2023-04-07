#include "esp_log.h"

#include "logging.h"

void enable_logging() {
  esp_log_level_set("*", ESP_LOG_INFO);
}

void disable_logging() {
  esp_log_level_set("*", ESP_LOG_NONE);
}
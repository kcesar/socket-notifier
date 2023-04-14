#include "driver/gpio.h"
#include "esp_log.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include <stdio.h>

#include "button.h"
#include "setup.h"
#include "speaker.h"
#include "websocket.h"
#include "led.h"

#define ESP_INTR_FLAG_DEFAULT 0
#define DEBOUNCE_MS 300

static const char *TAG = "BUTTON";

static SemaphoreHandle_t clickSemaphore = NULL;

void IRAM_ATTR handleButtonInterrupt() {
  xSemaphoreGive(clickSemaphore);
}

void button_task(void *arg) {
  gpio_pad_select_gpio(BUTTON_A_PIN);
  gpio_set_direction(BUTTON_A_PIN, GPIO_MODE_INPUT);
  gpio_pullup_en(BUTTON_A_PIN);

  clickSemaphore = xSemaphoreCreateBinary();

  gpio_set_intr_type(BUTTON_A_PIN, GPIO_INTR_NEGEDGE);
  gpio_install_isr_service(ESP_INTR_FLAG_DEFAULT);
  gpio_isr_handler_add(BUTTON_A_PIN, handleButtonInterrupt, NULL);

  uint64_t lastClick = 0;
  while (1) {
    xSemaphoreTake(clickSemaphore, portMAX_DELAY);
    uint64_t now = esp_timer_get_time();
    if (now - (DEBOUNCE_MS * 1000) > lastClick) {
      uint64_t diff = now - lastClick;
      lastClick = now;
      ESP_LOGW(TAG, "Button was pressed %llu %llu", now, diff);
      speaker_silence();
      if (websocket_is_connected()) {
        // only show the light blip while we're connected, because if we're not connected
        // we're showing fading sequences.
        led_show("1 000088 0 000000 200");
        websocket_send_button(1);
      }
    }
  }
}

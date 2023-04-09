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
      speaker_play_const("0 1 1000 50");
      websocket_send_button(1);
    }
  }
}
// volatile int numberOfButtonInterrupts = 0;
// volatile bool lastState;
// volatile uint32_t debounceTimeout = 0;

// // For setting up critical sections (enableinterrupts and disableinterrupts not available)
// // used to disable and interrupt interrupts
// portMUX_TYPE mux = portMUX_INITIALIZER_UNLOCKED;

// // SemaphoreHandle_t xSemaphore = NULL;

// // Interrupt Service Routine - Keep it short!
// void IRAM_ATTR handleButtonInterrupt() {
//   portENTER_CRITICAL_ISR(&mux);
//   numberOfButtonInterrupts++;
//   lastState = gpio_get_level(BUTTON_A_PIN);
//   debounceTimeout = esp_timer_get_time(); // version of millis() that works from interrupt
//   portEXIT_CRITICAL_ISR(&mux);
// }

// // task that will react to button clicks
// void button_task(void *arg) {
//   // configure button and led pins as GPIO pins
//   gpio_pad_select_gpio(BUTTON_A_PIN);

//   // set the correct direction
//   gpio_set_direction(BUTTON_A_PIN, GPIO_MODE_INPUT);
//   gpio_pullup_en(BUTTON_A_PIN);

//   // enable interrupt on falling (1->0) edge for button pin
//   gpio_set_intr_type(BUTTON_A_PIN, GPIO_INTR_POSEDGE);

//   // install ISR service with default configuration
//   gpio_install_isr_service(ESP_INTR_FLAG_DEFAULT);

//   // attach the interrupt service routine
//   gpio_isr_handler_add(BUTTON_A_PIN, handleButtonInterrupt, NULL);

//   uint64_t saveDebounceTimeout;
//   bool saveLastState;
//   int save;

//   while (1) {
//     portENTER_CRITICAL_ISR(&mux); // so that value of numberOfButtonInterrupts,l astState are atomic - Critical Section
//     save = numberOfButtonInterrupts;
//     saveDebounceTimeout = debounceTimeout;
//     saveLastState = lastState;
//     portEXIT_CRITICAL_ISR(&mux); // end of Critical Section

//     bool currentState = gpio_get_level(BUTTON_A_PIN);

//     // This is the critical IF statement
//     // if Interrupt Has triggered AND Button Pin is in same state AND the debounce time has expired THEN you have the button push!
//     //
//     if ((save != 0)                                                      // interrupt has triggered
//         && (currentState == saveLastState)                               // pin is still in the same state as when intr triggered
//         && (esp_timer_get_time() - saveDebounceTimeout > DEBOUNCETIME)) { // and it has been low for at least DEBOUNCETIME, then valid keypress

//       if (currentState == 0) {
//         ESP_LOGW(TAG, "Button is pressed and debounced, current tick=%llu\n", esp_timer_get_time());
//       } else {
//         ESP_LOGW(TAG, "Button is released and debounced, current tick=%llu\n", esp_timer_get_time());
//       }

//       ESP_LOGW(TAG, "Button Interrupt Triggered %d times, current State=%u, time since last trigger %lluus\n", save, currentState, esp_timer_get_time()- saveDebounceTimeout);

//       portENTER_CRITICAL_ISR(&mux); // can't change it unless, atomic - Critical section
//       numberOfButtonInterrupts = 0; // acknowledge keypress and reset interrupt counter
//       portEXIT_CRITICAL_ISR(&mux);

//       vTaskDelay(10 / portTICK_PERIOD_MS);
//     }

//     vTaskDelay(10 / portTICK_PERIOD_MS);
//   }
// }
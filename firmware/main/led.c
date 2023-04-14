#include "driver/ledc.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/semphr.h"
#include "freertos/task.h"
#include <stdio.h>
#include <string.h>

#include "led.h"
#include "setup.h"

#define NUM_CHANNELS 3
#define NUM_CHANNELS_W_TIMING (NUM_CHANNELS + 1)

#define MAX_INTERVAL_MS 300

static const char *TAG = "LED";

static const ledc_channel_t ledChannels[NUM_CHANNELS_W_TIMING] = { LEDC_CHANNEL_1, LEDC_CHANNEL_2, LEDC_CHANNEL_3, LEDC_CHANNEL_4 };
static const int ledPins[NUM_CHANNELS_W_TIMING] = { LED_R_PIN, LED_G_PIN, LED_B_PIN, LED_TIMING_PIN };
static SemaphoreHandle_t allChannelsSync = NULL;
static SemaphoreHandle_t runShow = NULL;
static uint16_t timingDuty = 0x0;
static uint8_t lastColors[NUM_CHANNELS];

struct DisplayNode_t {
  uint8_t rgbDuty[NUM_CHANNELS];
  int ms;
  uint8_t replays;
  struct DisplayNode_t *next;
};
struct DisplayNode_t *displayStart = NULL;
struct DisplayNode_t *nextDisplayStep = NULL;
static portMUX_TYPE updateDisplayLock = portMUX_INITIALIZER_UNLOCKED;



static uint8_t fromHex(char ch) {
  //ESP_LOGI(TAG, "fromHex %c %d", ch, ch);
  if (ch >= '0' && ch <= '9') return ch - '0';
  if (ch >= 'A' && ch <= 'F') return ch - 'A' + 10;
  return 0;
}

static struct DisplayNode_t* parseShow(const char* display) {
  int len = strlen(display);
  char *ch = (char*)display;
  int replays = 0;
  
  struct DisplayNode_t *first = NULL;
  struct DisplayNode_t *last = NULL;

  int sign = 1;
  if (*ch == '-') {
    sign = -1;
    ch++;
  }
  while (ch < display + len && *ch != '\0' && *ch != ' ') {
    replays = replays * 10 + (*ch - '0');
    ch++;
  }
  ch++; // eat the space

  replays = replays * sign;

  memset(lastColors, 0, sizeof(lastColors));
  uint8_t toColors[NUM_CHANNELS];
  int ms = 0;

  while (ch < display + len) {
    for (int i=0; i<NUM_CHANNELS; i++) {
      //ESP_LOGI(TAG, "Is space? %c", *ch);
      toColors[i] = fromHex(*ch) * 16 + fromHex(*ch);
      ch += 2;
      //ESP_LOGI(TAG, "RGB %d %d", i, toColors[i]);
    }
    ch++; // eat the space

    ms = 0;
    while (ch < display + len && *ch != '\0' && *ch != ' ') {
      ms = 10 * ms + (*ch - '0');
      ch++;
      //ESP_LOGI(TAG, "MS %d", ms);
    }
    ch++; // eat the space

    int remainingMs = ms;
    uint64_t duty;
    do {
      struct DisplayNode_t *node = malloc(sizeof(struct DisplayNode_t));
      node->replays = replays;

      if (ms == 0) {
        memcpy(node->rgbDuty, toColors, sizeof(toColors));
        node->ms = 0;
        remainingMs = 0;
      } else {
        for (int i=0; i<NUM_CHANNELS; i++) {
          duty = ((lastColors[i] * (remainingMs)) + (toColors[i] * (ms - remainingMs))) / ms;
          node->rgbDuty[i] = duty;
        }
        node->ms = remainingMs > MAX_INTERVAL_MS ? MAX_INTERVAL_MS : remainingMs;
        remainingMs -= MAX_INTERVAL_MS;
      }

      if (first == NULL) {
        first = node;
      } else {
        last->next = node;
      }
      last = node;
    } while (remainingMs > 0);
    memcpy(lastColors, toColors, sizeof(toColors));
  }
  last->next = first;
  return first;
}



static IRAM_ATTR bool cb_ledc_fade_end_event(const ledc_cb_param_t *param, void *user_arg)
{
    portBASE_TYPE taskAwoken = pdFALSE;

    if (param->event == LEDC_FADE_END_EVT) {
        SemaphoreHandle_t sync = (SemaphoreHandle_t) user_arg;
        xSemaphoreGiveFromISR(sync, &taskAwoken);
    }

    return (taskAwoken == pdTRUE);
}

static void abortDisplay(bool shutdown) {
  struct DisplayNode_t *ptr = displayStart;
  taskENTER_CRITICAL(&updateDisplayLock);
  displayStart = NULL;
  taskEXIT_CRITICAL(&updateDisplayLock);

  struct DisplayNode_t *begin = NULL;
  while (ptr != begin) {
    if (begin == NULL) begin = ptr;
    struct DisplayNode_t *next = ptr->next;
    free(ptr);
    ptr = next;
  }

  if (shutdown) {
    for (int i=0; i<NUM_CHANNELS_W_TIMING; i++) {
      ledc_stop(LEDC_LOW_SPEED_MODE, ledChannels[i], 0);
    }
    for (int i=0; i<NUM_CHANNELS; i++) {
      lastColors[i] = 0;
    }
  }
}

static void playNextStep() {
  //ESP_LOGI(TAG, "ENTER playNextStep");
  int64_t stepFinishTime = esp_timer_get_time();
  if (nextDisplayStep != NULL) {
    bool play = false;
    uint8_t duties[NUM_CHANNELS];
    int ms = 0;

    taskENTER_CRITICAL(&updateDisplayLock);
    if (nextDisplayStep->replays != 0) {
      if (nextDisplayStep->replays > 0) nextDisplayStep->replays--;
      play = true;
      memcpy(duties, nextDisplayStep->rgbDuty, sizeof(duties));
      ms = nextDisplayStep->ms;
      stepFinishTime += ms * 1000;

      nextDisplayStep = nextDisplayStep->next;
    }
    taskEXIT_CRITICAL(&updateDisplayLock);

    if (play) {
      //ESP_LOGI(TAG, "MS %d", ms);
      if (ms < 30) {
        for (int i=0; i<NUM_CHANNELS; i++) {
          ledc_set_duty(LEDC_LOW_SPEED_MODE, ledChannels[i], duties[i]);
          ledc_update_duty(LEDC_LOW_SPEED_MODE, ledChannels[i]);
        }
      } else {
        int64_t start = esp_timer_get_time();
        timingDuty = (~timingDuty) & 0x3ff;
        ledc_set_fade_with_time(LEDC_LOW_SPEED_MODE, ledChannels[NUM_CHANNELS], timingDuty, ms);
        ledc_fade_start(LEDC_LOW_SPEED_MODE, ledChannels[NUM_CHANNELS], LEDC_FADE_NO_WAIT);
        for (int i=0; i<NUM_CHANNELS; i++) {
          ledc_set_fade_with_time(LEDC_LOW_SPEED_MODE, ledChannels[i], duties[i] << 2, ms);
          ledc_fade_start(LEDC_LOW_SPEED_MODE, ledChannels[i], LEDC_FADE_NO_WAIT);  
        }
  
        for (int i=0; i<NUM_CHANNELS_W_TIMING; i++) {
          xSemaphoreTake(allChannelsSync, portMAX_DELAY); 
        }
      }
    } else {
      //ESP_LOGI(TAG, "Finished display. should clean up");
      abortDisplay(true);
      xSemaphoreTake(runShow, portMAX_DELAY);
    }
  }

  //ESP_LOGI(TAG, "EXIT playNextStep");
}


void led_show(const char *display) {
  abortDisplay(false);
  ESP_LOGI(TAG, "Parsing show %s", display);
  displayStart = nextDisplayStep = parseShow(display);

  // struct DisplayNode_t *walk = displayStart;
  // do {
  //   ESP_LOGI(TAG, "PART %d,%d,%d %dms x%d", (uint8_t)walk->rgbDuty[0], (uint8_t)walk->rgbDuty[1], (uint8_t)walk->rgbDuty[2], walk->ms, walk->replays);
  //   walk = walk->next;
  // } while (walk != NULL && walk != displayStart);

  while (runShow == NULL) {
    ESP_LOGI(TAG, "Waiting for LED to finish setup");
    vTaskDelay(100 / portTICK_PERIOD_MS);
  }
  xSemaphoreGive(runShow);
}

void led_stop() {
  abortDisplay(true);
}

void led_task(void *args) {
  ESP_LOGI(TAG, "Task is starting ...");

  ledc_timer_config_t timer_config = {
      .duty_resolution = LEDC_TIMER_10_BIT, // resolution of PWM duty
      .freq_hz = 5000,                     // frequency of PWM signal
      .speed_mode = LEDC_LOW_SPEED_MODE,   // timer mode
      .timer_num = LEDC_TIMER_2,           // timer index
      .clk_cfg = LEDC_AUTO_CLK,            // Auto select the source clock
  };
  ledc_timer_config(&timer_config);

  for (int i=0; i<NUM_CHANNELS_W_TIMING; i++) {
    ESP_LOGI(TAG, "Config channel %d %d", ledChannels[i], ledPins[i]);
    ledc_channel_config_t channel_config = {
      .channel = ledChannels[i],
      .duty = i == NUM_CHANNELS ? timingDuty : 0,
      .gpio_num = ledPins[i],
      .speed_mode = LEDC_LOW_SPEED_MODE,
      .hpoint = 0,
      .timer_sel = LEDC_TIMER_2,
      .flags.output_invert = 1,
    };
    ledc_channel_config(&channel_config);
  }

  ledc_fade_func_install(0);
  ledc_cbs_t callbacks = {
      .fade_cb = cb_ledc_fade_end_event
  };

  runShow = xSemaphoreCreateBinary();
  allChannelsSync = xSemaphoreCreateCounting(NUM_CHANNELS_W_TIMING, 0);
  for (int i = 0; i < NUM_CHANNELS_W_TIMING; i++) {
    ledc_cb_register(LEDC_LOW_SPEED_MODE, ledChannels[i], &callbacks, (void *) allChannelsSync);
  }

  ESP_LOGI(TAG, "Waiting for first light show");
  xSemaphoreTake(runShow, portMAX_DELAY);
  while (1) {
    playNextStep();
  }
}
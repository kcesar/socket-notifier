#include "driver/gpio.h"
#include "driver/ledc.h"
#include "esp_log.h"
#include "esp_timer.h"
#include "freertos/FreeRTOS.h"
#include "freertos/task.h"
#include "freertos/timers.h"
#include <string.h>

#include "setup.h"
#include "speaker.h"

static const char *TAG = "SPEAKER";

struct SongNode_t {
  int freq;
  int ms;
  int replays;
  struct SongNode_t *next;
};

int playOnSpeaker = -1;
struct SongNode_t *song = NULL;
static esp_timer_handle_t beepTimer = NULL;

// void speaker_play(char *songText) {
//   ESP_LOGI(TAG, "Play Song %s", songText);
//   char *marker;
//   char *token = strtok_r(songText, " ", &marker);
//   replays = atoi(token);

//   struct SongNode_t *head = NULL;
//   struct SongNode_t *lastNote = NULL;
//   do {
//     struct SongNode_t *note = (struct SongNode_t *)malloc(sizeof(struct SongNode_t));
//     note->replays = replays;

//     token = strtok_r(NULL, " ", &marker);
//     note->freq = atoi(token);

//     token = strtok_r(NULL, " ", &marker);
//     note->ms = atoi(token);
//     if (head == NULL) {
//       head = note;
//     } else {
//       lastNote->next = note;
//     }
//     lastNote = note;
//   } while (token != NULL && marker != NULL);

//   // Make the list a loop so we can repeat the song.
//   if (lastNote != NULL) {
//     lastNote->next = head;
//   }

//   speaker_silence();
//   song = head;
// }

// void speaker_silence() {
//   ledc_timer_pause(LEDC_LOW_SPEED_MODE, LEDC_TIMER_1);

//   struct SongNode_t *ptr = song;
//   struct SongNode_t *begin = NULL;
//   song = NULL;

//   while (ptr != begin) {
//     if (begin == NULL) begin = ptr;
//     struct SongNode_t *next = ptr->next;
//     free(ptr);
//     ptr = next;
//   }
// }

void speaker_silence() {
  playOnSpeaker = -1;
  if (beepTimer != NULL) {
    esp_timer_delete(beepTimer);
    beepTimer = NULL;
  }
  gpio_set_level(BEEPER_PIN, 0);
  
  struct SongNode_t *ptr = song;
  struct SongNode_t *begin = NULL;
  song = NULL;

  while (ptr != begin) {
    if (begin == NULL) begin = ptr;
    struct SongNode_t *next = ptr->next;
    free(ptr);
    ptr = next;
  }
}

static void playNextBeep() {
  if (song == NULL || song->replays == 0) {
    speaker_silence();
    return;
  };

  if (beepTimer == NULL) {
    const esp_timer_create_args_t beepArgs = {
      .callback = &playNextBeep,
      .name = "beep timer",
    };
    esp_timer_create(&beepArgs, &beepTimer);
  }
  ESP_LOGI(TAG, "BEEP: %d %d (remaining %d)", song->freq > 0, song->ms, song->replays);
  gpio_set_level(BEEPER_PIN, song->freq > 0);
  esp_timer_start_once(beepTimer, song->ms * 1000);
  song->replays--;
  song = song->next;
}

void speaker_play(char *songText) {
  ESP_LOGI(TAG, "Play Song %s", songText);

  char *marker;
  const char* token = strtok_r(songText, " ", &marker);
  ESP_LOGI(TAG, "Parsing token %s :: %s", token, marker);
  int speakerId = atoi(token);
  if (speakerId > 1) return;

  int replays = atoi(strtok_r(NULL, " ", &marker));

  struct SongNode_t *head = NULL;
  struct SongNode_t *lastNote = NULL;
  do {
    struct SongNode_t *note = (struct SongNode_t *)malloc(sizeof(struct SongNode_t));
    note->replays = replays;

    note->freq = atoi(strtok_r(NULL, " ", &marker));
    note->ms = atoi(strtok_r(NULL, " ", &marker));

    if (head == NULL) {
      head = note;
    } else {
      lastNote->next = note;
    }
    lastNote = note;
  } while (marker != NULL);

  // Make the list a loop so we can repeat the song.
  if (lastNote != NULL) {
    lastNote->next = head;
  }

  speaker_silence();
  song = head;
  playOnSpeaker = speakerId;
  if (playOnSpeaker == 0) {
    playNextBeep();
  }
}

void speaker_play_const(const char *song) {
  char songbuf[strlen(song) + 1];
  strcpy(songbuf, song);
  speaker_play(songbuf);
}

void speaker_setup() {
  gpio_reset_pin(BEEPER_PIN);
  gpio_set_direction(BEEPER_PIN, GPIO_MODE_OUTPUT);
  gpio_set_level(BEEPER_PIN, 0);
}

void speaker_task(void *args) {
  ESP_LOGI(TAG, "Task is starting ...");

  while (1) {
    vTaskDelay(500 / portTICK_PERIOD_MS);    
  }
}

// void speaker_task_tones(void *args) {
//   ESP_LOGI(TAG, "Task is starting ...");
//   ledc_timer_config_t ledc_timer = {
//       .speed_mode = LEDC_LOW_SPEED_MODE,
//       .duty_resolution = LEDC_TIMER_8_BIT,
//       .timer_num = LEDC_TIMER_1,
//       .freq_hz = 10,
//       .clk_cfg = LEDC_AUTO_CLK,
//   };
//   ledc_timer_config(&ledc_timer);
//   ledc_channel_config_t ledc_channel = {
//       .gpio_num = BEEPER_PIN,
//       .speed_mode = LEDC_LOW_SPEED_MODE,
//       .channel = LEDC_CHANNEL_0,
//       .timer_sel = LEDC_TIMER_1,
//       .duty = 0x1f,
//       .hpoint = 0,
//   };
//   ledc_channel_config(&ledc_channel);
//   ledc_timer_pause(LEDC_LOW_SPEED_MODE, LEDC_TIMER_1);

//   while (1) {
//     if (song == NULL || song->replays == 0) {
//       speaker_silence();

//       vTaskDelay(500 / portTICK_PERIOD_MS);
//     } else {
//       int ms = song->ms;

//       ESP_LOGI(TAG, "NOTE: %d %d (remaining %d)", song->freq, song->ms, song->replays);
//       if (song->freq == 0) {
//         ledc_timer_pause(LEDC_LOW_SPEED_MODE, LEDC_TIMER_1);
//       } else {
//         ledc_set_freq(LEDC_LOW_SPEED_MODE, LEDC_TIMER_1, song->freq);
//         ledc_timer_resume(LEDC_LOW_SPEED_MODE, LEDC_TIMER_1);
//       }
//       song->replays--;
//       song = song->next;
//       vTaskDelay(ms / portTICK_PERIOD_MS);
//     }
//   }
// }
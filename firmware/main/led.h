#ifndef LED_H
#define LED_H

void led_task(void *args);
void led_show(const char* display);
void led_stop();

#endif
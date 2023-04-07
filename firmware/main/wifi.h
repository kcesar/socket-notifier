#ifndef WIFI_H
#define WIFI_H

#include <stdbool.h>

bool wait_for_ip();
void wifi_init_sta(const char* ssid, const char* password);

#endif

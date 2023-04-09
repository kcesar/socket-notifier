#ifndef WEBSOCKET_H
#define WEBSOCKET_H

#include "speaker.h"

void websocket_start(char *server, char *callsign);
void websocket_send_button(uint8_t buttonId);
#endif

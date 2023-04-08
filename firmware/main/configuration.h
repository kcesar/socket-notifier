#ifndef CONFIGURATION_H
#define CONFIGURATION_H

struct AppConfig {
  char *wifi_ssid;
  char *wifi_password;
  char *server;
  char *callsign;
};

struct AppConfig *config_read();
void configure_task(void *args);
#endif
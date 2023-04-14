#ifndef OTA_H
#define OTA_H

#define OTA_HASH_LEN 32
#define OTA_HASH_STR_LEN (OTA_HASH_LEN * 2 + 1)

const char* ota_get_partition_hash();
void ota_start_update();

#endif
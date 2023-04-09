#ifndef SPEAKER_H
#define SPEAKER_H

void speaker_setup();
void speaker_play_const(const char *song);
void speaker_play(char *song);
void speaker_silence();
void speaker_task(void *args);

#endif

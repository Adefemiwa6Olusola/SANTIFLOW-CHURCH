// commandAgent.js
// Dedicated agent for handling voice commands to navigate scriptures and control presentation

import useAppStore from '../store/appStore';
import { fetchVerse } from './bibleService';
import { syncService } from './syncService';

class CommandAgent {
  constructor() {
    this.isProcessing = false;
  }

  async executeCommand(cmd) {
    if (this.isProcessing) return;
    this.isProcessing = true;

    try {
      const state = useAppStore.getState();
      const currentVerse = state.currentVerse;
      const addToast = state.addToast;
      const setCurrentVerse = state.setCurrentVerse;

      switch (cmd.action) {
        case 'clear_screen':
        case 'hide_verse':
          setCurrentVerse(null);
          syncService.sendClear();
          addToast({ type: 'info', message: 'Screen cleared' });
          break;

        case 'switch_translation':
          if (cmd.params?.translation) {
            const trans = cmd.params.translation.toUpperCase();
            state.setActiveTranslation(trans);
            syncService.sendTranslation(trans);
            addToast({ type: 'success', message: `Translation switched to ${trans}` });
            
            // Re-fetch current verse in new translation
            if (currentVerse) {
              const newVerse = await fetchVerse(
                trans,
                currentVerse.book,
                currentVerse.chapter,
                currentVerse.verseStart,
                currentVerse.verseEnd
              );
              setCurrentVerse(newVerse);
              if (state.isLive) syncService.sendVerse(newVerse);
            }
          }
          break;

        case 'next_verse':
          if (currentVerse) {
            try {
              const next = await fetchVerse(
                currentVerse.translation,
                currentVerse.book,
                currentVerse.chapter,
                currentVerse.verseEnd + 1
              );
              setCurrentVerse(next);
              if (state.isLive) syncService.sendVerse(next);
              addToast({ type: 'info', message: `Advanced to ${next.reference}` });
            } catch (e) {
              // Might be end of chapter
              try {
                const nextChap = await fetchVerse(
                  currentVerse.translation,
                  currentVerse.book,
                  currentVerse.chapter + 1,
                  1
                );
                setCurrentVerse(nextChap);
                if (state.isLive) syncService.sendVerse(nextChap);
                addToast({ type: 'info', message: `Advanced to ${nextChap.reference}` });
              } catch (err) {
                addToast({ type: 'warning', message: 'Reached end of book' });
              }
            }
          } else {
            addToast({ type: 'warning', message: 'No active verse to advance from' });
          }
          break;

        case 'prev_verse':
          if (currentVerse) {
            if (currentVerse.verseStart > 1) {
              const prev = await fetchVerse(
                currentVerse.translation,
                currentVerse.book,
                currentVerse.chapter,
                currentVerse.verseStart - 1
              );
              setCurrentVerse(prev);
              if (state.isLive) syncService.sendVerse(prev);
            } else if (currentVerse.chapter > 1) {
              // Simplistic: just goes to chapter-1 verse 1. Getting last verse of prev chapter requires fetching it.
              const prevChap = await fetchVerse(
                currentVerse.translation,
                currentVerse.book,
                currentVerse.chapter - 1,
                1
              );
              setCurrentVerse(prevChap);
              if (state.isLive) syncService.sendVerse(prevChap);
            }
          }
          break;

        case 'increase_font':
          state.setFontSize(state.fontSize + 0.1);
          break;
        case 'decrease_font':
          state.setFontSize(state.fontSize - 0.1);
          break;
          
        case 'fullscreen':
          if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch(() => {});
          } else {
            document.exitFullscreen().catch(() => {});
          }
          break;
      }
    } catch (error) {
      console.error('Command execution failed:', error);
    } finally {
      this.isProcessing = false;
    }
  }
}

export const commandAgent = new CommandAgent();
export default commandAgent;

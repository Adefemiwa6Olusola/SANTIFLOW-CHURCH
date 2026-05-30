// SanctiFlow Verse Navigator
// Stateful verse-by-verse and chapter navigation engine

import { fetchChapter, fetchVerse } from './bibleService';

class VerseNavigator {
  constructor() {
    this.book = null;
    this.chapter = null;
    this.verseStart = null;
    this.verseEnd = null;
    this.translation = 'KJV';
    this.chapterCache = null;
  }

  setPosition(verseData) {
    this.book = verseData.book;
    this.chapter = verseData.chapter;
    this.verseStart = verseData.verseStart;
    this.verseEnd = verseData.verseEnd || verseData.verseStart;
    this.translation = verseData.translation || this.translation;
    this.chapterCache = null; // Reset cache on position change
  }

  async loadChapter() {
    if (!this.book || !this.chapter) return null;
    if (!this.chapterCache) {
      this.chapterCache = await fetchChapter(this.translation, this.book, this.chapter);
    }
    return this.chapterCache;
  }

  async nextVerse() {
    if (!this.book) return null;
    try {
      const chapter = await this.loadChapter();
      if (!chapter) return null;

      const maxVerse = chapter.verses.length > 0 
        ? chapter.verses[chapter.verses.length - 1].verse 
        : this.verseStart;

      if (this.verseStart < maxVerse) {
        // Move to next verse in same chapter
        this.verseStart = this.verseStart + 1;
        this.verseEnd = this.verseStart;
      } else {
        // Move to next chapter verse 1
        return await this.nextChapter();
      }

      return await fetchVerse(this.translation, this.book, this.chapter, this.verseStart, this.verseEnd);
    } catch (e) {
      console.error('[VerseNavigator] nextVerse error:', e);
      return null;
    }
  }

  async prevVerse() {
    if (!this.book) return null;
    try {
      if (this.verseStart > 1) {
        this.verseStart = this.verseStart - 1;
        this.verseEnd = this.verseStart;
        this.chapterCache = null;
        return await fetchVerse(this.translation, this.book, this.chapter, this.verseStart, this.verseEnd);
      } else {
        // Move to previous chapter, last verse
        return await this.prevChapter(true);
      }
    } catch (e) {
      console.error('[VerseNavigator] prevVerse error:', e);
      return null;
    }
  }

  async nextChapter() {
    if (!this.book) return null;
    try {
      this.chapter = this.chapter + 1;
      this.verseStart = 1;
      this.verseEnd = 1;
      this.chapterCache = null;
      return await fetchVerse(this.translation, this.book, this.chapter, 1, 1);
    } catch (e) {
      // Chapter doesn't exist — likely end of book
      console.warn('[VerseNavigator] nextChapter: end of book');
      this.chapter = this.chapter - 1;
      return null;
    }
  }

  async prevChapter(goToLastVerse = false) {
    if (!this.book || this.chapter <= 1) return null;
    try {
      this.chapter = this.chapter - 1;
      this.chapterCache = null;
      
      if (goToLastVerse) {
        const chapter = await this.loadChapter();
        if (chapter && chapter.verses.length > 0) {
          const lastVerse = chapter.verses[chapter.verses.length - 1].verse;
          this.verseStart = lastVerse;
          this.verseEnd = lastVerse;
          return await fetchVerse(this.translation, this.book, this.chapter, lastVerse, lastVerse);
        }
      }
      
      this.verseStart = 1;
      this.verseEnd = 1;
      return await fetchVerse(this.translation, this.book, this.chapter, 1, 1);
    } catch (e) {
      console.error('[VerseNavigator] prevChapter error:', e);
      return null;
    }
  }

  async repeatVerse() {
    if (!this.book) return null;
    try {
      return await fetchVerse(this.translation, this.book, this.chapter, this.verseStart, this.verseEnd);
    } catch (e) {
      return null;
    }
  }

  hasPosition() {
    return !!(this.book && this.chapter && this.verseStart);
  }

  getPosition() {
    return {
      book: this.book,
      chapter: this.chapter,
      verseStart: this.verseStart,
      verseEnd: this.verseEnd,
      translation: this.translation,
    };
  }
}

export const verseNavigator = new VerseNavigator();
export default verseNavigator;

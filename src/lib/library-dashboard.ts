import type { BookProgressState } from './book-progress';

export type LibraryDashboardBook = {
  id: string;
  title: string;
  type: string;
  coverImageUri?: string;
  updatedAt?: number;
  archived?: boolean;
  weekWords: number;
  progress: BookProgressState;
};

export function getLibraryDashboardSummary(books: LibraryDashboardBook[], activeBookId?: string) {
  const unfinished = books.filter((book) => !book.archived && book.progress.progressPercent < 100);
  const focusBook = books.find((book) => book.id === activeBookId && !book.archived)
    ?? [...unfinished].sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0]
    ?? books.find((book) => !book.archived);
  const nextBook = [...unfinished]
    .filter((book) => book.id !== focusBook?.id)
    .sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))[0];

  return {
    focusBook,
    nextBook,
    totalWords: books.reduce((sum, book) => sum + book.progress.wordCount, 0),
    completedParts: books.reduce((sum, book) => sum + book.progress.completedPartCount, 0),
    completedBooks: books.filter((book) => book.progress.progressPercent === 100).length,
    activeBooks: unfinished.length,
    weekWords: books.reduce((sum, book) => sum + Math.max(0, book.weekWords), 0),
  };
}

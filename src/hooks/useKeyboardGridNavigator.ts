import { useEffect } from 'react';

interface KeyboardGridNavigatorOptions {
  rowCount: number;
  colCount: number;
  onAddRow?: () => void;
  onToggleHelp?: () => void;
}

export function useKeyboardGridNavigator({
  rowCount,
  colCount,
  onAddRow,
  onToggleHelp,
}: KeyboardGridNavigatorOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // ── Global shortcuts (Alt+...) ──────────────────────────────
      if (e.altKey) {
        if (e.key === 'a' || e.key === 'A') {
          e.preventDefault();
          onAddRow?.();
          return;
        }
        if (e.key === 'h' || e.key === 'H') {
          e.preventDefault();
          onToggleHelp?.();
          return;
        }
      }

      // ── Grid navigation (only when focused on a nav-cell) ───────
      const active = document.activeElement as HTMLElement;
      if (!active || !active.hasAttribute('data-row') || !active.hasAttribute('data-col')) {
        return;
      }

      const currentRow = parseInt(active.getAttribute('data-row') || '0', 10);
      const currentCol = parseInt(active.getAttribute('data-col') || '0', 10);

      let nextRow = currentRow;
      let nextCol = currentCol;
      let preventDefault = false;

      switch (e.key) {
        case 'ArrowUp':
          preventDefault = true;
          nextRow = Math.max(0, currentRow - 1);
          break;
        case 'ArrowDown':
          preventDefault = true;
          nextRow = Math.min(rowCount - 1, currentRow + 1);
          break;
        case 'ArrowRight':
          preventDefault = true;
          if (currentCol === colCount - 1) {
            if (currentRow < rowCount - 1) {
              nextRow = currentRow + 1;
              nextCol = 0;
            } else if (onAddRow) {
              onAddRow();
            }
          } else {
            nextCol = currentCol + 1;
          }
          break;
        case 'ArrowLeft':
          preventDefault = true;
          if (currentCol === 0) {
            if (currentRow > 0) {
              nextRow = currentRow - 1;
              nextCol = colCount - 1;
            }
          } else {
            nextCol = currentCol - 1;
          }
          break;
        case 'Enter':
          if (active.tagName === 'BUTTON') return;
          preventDefault = true;
          if (currentCol === colCount - 1) {
            if (currentRow < rowCount - 1) {
              nextRow = currentRow + 1;
              nextCol = 0;
            } else if (onAddRow) {
              onAddRow();
            }
          } else {
            nextCol = currentCol + 1;
          }
          break;
        case 'Tab':
          if (e.shiftKey) {
            preventDefault = true;
            if (currentCol === 0) {
              if (currentRow > 0) {
                nextRow = currentRow - 1;
                nextCol = colCount - 1;
              }
            } else {
              nextCol = currentCol - 1;
            }
          } else {
            preventDefault = true;
            if (currentCol === colCount - 1) {
              if (currentRow < rowCount - 1) {
                nextRow = currentRow + 1;
                nextCol = 0;
              } else if (onAddRow) {
                onAddRow();
              }
            } else {
              nextCol = currentCol + 1;
            }
          }
          break;
        default:
          return;
      }

      if (preventDefault) {
        e.preventDefault();
      }

      if (nextRow !== currentRow || nextCol !== currentCol) {
        const nextElement = document.querySelector(
          `[data-row="${nextRow}"][data-col="${nextCol}"].nav-cell`
        ) as HTMLInputElement | HTMLButtonElement;

        if (nextElement) {
          nextElement.focus();
          if (nextElement instanceof HTMLInputElement) {
            nextElement.select?.();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [rowCount, colCount, onAddRow, onToggleHelp]);
}

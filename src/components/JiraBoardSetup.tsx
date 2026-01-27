import { TextAttributes, type ParsedKey } from '@opentui/core';
import { useKeyboard } from '@opentui/react';
import { useAtomValue, useAtomSet, Result } from '@effect-atom/atom-react';
import { useState, useEffect } from 'react';
import { Effect } from 'effect';
import { Colors } from '../colors';
import { appAtomRuntime } from '../appLayerRuntime';
import { fetchBoards } from '../jira/jira-sprint-service';
import type { JiraBoard } from '../jira/jira-sprint-schema';
import { setJiraBoardIdAtom } from '../settings/settings-atom';

interface JiraBoardSetupProps {
  onClose: () => void;
  onBoardSelected: (boardId: number) => void;
  currentBoardId?: number;
}

const loadBoardsAtom = appAtomRuntime.fn(() =>
  Effect.gen(function* () {
    return yield* fetchBoards();
  })
);

export default function JiraBoardSetup({ onClose, onBoardSelected, currentBoardId }: JiraBoardSetupProps) {
  const loadBoardsResult = useAtomValue(loadBoardsAtom);
  const loadBoards = useAtomSet(loadBoardsAtom);
  const setJiraBoardId = useAtomSet(setJiraBoardIdAtom, { mode: 'promiseExit' });

  const [selectedIndex, setSelectedIndex] = useState(0);

  const boards: JiraBoard[] = Result.match(loadBoardsResult, {
    onInitial: () => [],
    onSuccess: ({ value }) => value,
    onFailure: () => [],
  });

  const isLoading = Result.isWaiting(loadBoardsResult);
  const hasError = Result.isFailure(loadBoardsResult);
  const errorMessage = hasError ? String(loadBoardsResult.cause) : null;
  const notLoaded = Result.isInitial(loadBoardsResult);

  useEffect(() => {
    if (currentBoardId && boards.length > 0) {
      const idx = boards.findIndex(b => b.id === currentBoardId);
      if (idx >= 0) setSelectedIndex(idx);
    }
  }, [boards, currentBoardId]);

  const handleSelectBoard = async () => {
    const board = boards[selectedIndex];
    if (board) {
      await setJiraBoardId(board.id);
      onBoardSelected(board.id);
    }
  };

  useKeyboard((key: ParsedKey) => {
    switch (key.name) {
      case 'escape':
      case 'q':
        onClose();
        break;
      case 'j':
      case 'down':
        if (selectedIndex < boards.length - 1) {
          setSelectedIndex(selectedIndex + 1);
        }
        break;
      case 'k':
      case 'up':
        if (selectedIndex > 0) {
          setSelectedIndex(selectedIndex - 1);
        }
        break;
      case 'return':
        handleSelectBoard();
        break;
      case 'r':
        loadBoards();
        break;
    }
  });

  return (
    <box
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: Colors.BACKGROUND,
        flexDirection: 'column',
        zIndex: 1000,
      }}
    >
      <box style={{ flexDirection: 'column', padding: 1 }}>
        <box style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <text style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }} wrapMode='none'>
            Select Jira Board
          </text>
          <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
            q: close | r: load boards | j/k: nav | Enter: select
          </text>
        </box>
        <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
          {'─'.repeat(100)}
        </text>
      </box>

      {isLoading && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.INFO }} wrapMode='none'>
            Loading boards...
          </text>
        </box>
      )}

      {hasError && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.ERROR }} wrapMode='none'>
            Error: {errorMessage}
          </text>
        </box>
      )}

      {notLoaded && !isLoading && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
            Press 'r' to load boards
          </text>
        </box>
      )}

      {!isLoading && !hasError && boards.length === 0 && !notLoaded && (
        <box style={{ padding: 2 }}>
          <text style={{ fg: Colors.NEUTRAL }} wrapMode='none'>
            No boards found
          </text>
        </box>
      )}

      {boards.length > 0 && (
        <scrollbox
          style={{
            flexGrow: 1,
            contentOptions: { backgroundColor: Colors.BACKGROUND },
            scrollbarOptions: {
              trackOptions: { foregroundColor: Colors.NEUTRAL, backgroundColor: Colors.TRACK },
            },
          }}
        >
          <box style={{ flexDirection: 'column' }}>
            {boards.map((board, index) => {
              const isSelected = index === selectedIndex;
              const isCurrent = board.id === currentBoardId;

              return (
                <box
                  key={board.id}
                  style={{
                    flexDirection: 'row',
                    backgroundColor: isSelected ? Colors.SELECTED : 'transparent',
                    gap: 1,
                  }}
                >
                  <text style={{ fg: Colors.SUCCESS, attributes: TextAttributes.BOLD }} wrapMode='none'>
                    {board.id}
                  </text>
                  <text style={{ fg: Colors.PRIMARY }} wrapMode='none'>
                    {board.name}
                  </text>
                  <text style={{ fg: Colors.SUPPORTING }} wrapMode='none'>
                    ({board.type})
                  </text>
                  {isCurrent && (
                    <text style={{ fg: Colors.INFO }} wrapMode='none'>
                      [current]
                    </text>
                  )}
                </box>
              );
            })}
          </box>
        </scrollbox>
      )}
    </box>
  );
}

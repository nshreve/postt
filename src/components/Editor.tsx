import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';
import { highlightMarkdown } from '../lib/markdown.js';

interface EditorProps {
  initialContent: string;
  title: string;
  onSave: (content: string) => Promise<void>;
  onPublish?: (content: string) => Promise<void>;
  onExit: () => void;
}

export function Editor({ initialContent, title, onSave, onPublish, onExit }: EditorProps) {
  const { exit } = useApp();
  const [content, setContent] = useState(initialContent);
  const [cursorLine, setCursorLine] = useState(0);
  const [cursorCol, setCursorCol] = useState(0);
  const [saved, setSaved] = useState(initialContent.trim() !== '');
  const [status, setStatus] = useState<'editing' | 'saving' | 'publishing' | 'confirm-exit'>('editing');
  const [hint, setHint] = useState('Start writing your post...');

  const lines = content.split('\n');
  const totalLines = lines.length;

  // Update hints based on context
  useEffect(() => {
    const currentLine = lines[cursorLine] || '';
    const isEmpty = content.trim() === '';

    if (isEmpty) {
      setHint('Start writing your post...');
    } else if (currentLine === '') {
      setHint('Type # for heading, - for list, > for quote');
    } else if (currentLine.startsWith('#')) {
      setHint('Heading — add more # for smaller');
    } else if (currentLine.startsWith('-') || currentLine.startsWith('*')) {
      setHint('List item — press Enter for next');
    } else if (currentLine.startsWith('>')) {
      setHint('Blockquote');
    } else {
      setHint('Use *italic* or **bold** markdown');
    }
  }, [cursorLine, lines, content]);

  const handleSave = useCallback(async () => {
    setStatus('saving');
    await onSave(content);
    setSaved(true);
    setTimeout(() => {
      onExit();
      exit();
    }, 500);
  }, [content, onSave, onExit, exit]);

  const handlePublish = useCallback(async () => {
    if (onPublish) {
      setStatus('publishing');
      await onSave(content);
      await onPublish(content);
      setTimeout(() => {
        onExit();
        exit();
      }, 1000);
    }
  }, [content, onSave, onPublish, onExit, exit]);

  useInput((input, key) => {
    // Backspace: delete character before cursor
    if (key.backspace || key.delete) {
      setSaved(false);
      if (cursorCol > 0) {
        const currentLine = lines[cursorLine] || '';
        const newLine = currentLine.slice(0, cursorCol - 1) + currentLine.slice(cursorCol);
        const newLines = [...lines];
        newLines[cursorLine] = newLine;
        setContent(newLines.join('\n'));
        setCursorCol(cursorCol - 1);
      } else if (cursorLine > 0) {
        const prevLine = lines[cursorLine - 1] || '';
        const currentLine = lines[cursorLine] || '';
        const newLines = [...lines];
        newLines[cursorLine - 1] = prevLine + currentLine;
        newLines.splice(cursorLine, 1);
        setContent(newLines.join('\n'));
        setCursorLine(cursorLine - 1);
        setCursorCol(prevLine.length);
      }
      return;
    }

    // Save and exit
    if (key.ctrl && input === 's') {
      handleSave();
      return;
    }

    // Publish and exit
    if (key.ctrl && input === 'p' && onPublish) {
      handlePublish();
      return;
    }

    // Filter out escape sequences
    if (input && (input.startsWith('\x1b') || (input.includes('[') && input.includes(';')))) {
      return;
    }

    // Handle confirm-exit mode
    if (status === 'confirm-exit') {
      if (input === 's' || input === 'S') {
        handleSave();
      } else if ((input === 'p' || input === 'P') && onPublish) {
        handlePublish();
      } else if (input === 'd' || input === 'D' || key.escape) {
        onExit();
        exit();
      }
      return;
    }

    // Escape to show exit confirmation
    if (key.escape) {
      setStatus('confirm-exit');
      return;
    }

    // Navigation
    if (key.upArrow) {
      setCursorLine((prev) => Math.max(0, prev - 1));
      return;
    }
    if (key.downArrow) {
      setCursorLine((prev) => Math.min(totalLines - 1, prev + 1));
      return;
    }
    if (key.leftArrow) {
      if (cursorCol > 0) {
        setCursorCol((prev) => prev - 1);
      } else if (cursorLine > 0) {
        setCursorLine((prev) => prev - 1);
        setCursorCol(lines[cursorLine - 1]?.length || 0);
      }
      return;
    }
    if (key.rightArrow) {
      const lineLength = lines[cursorLine]?.length || 0;
      if (cursorCol < lineLength) {
        setCursorCol((prev) => prev + 1);
      } else if (cursorLine < totalLines - 1) {
        setCursorLine((prev) => prev + 1);
        setCursorCol(0);
      }
      return;
    }

    // Enter - new line (with smart continuation for lists)
    if (key.return) {
      setSaved(false);
      const currentLine = lines[cursorLine] || '';
      const before = currentLine.slice(0, cursorCol);
      const after = currentLine.slice(cursorCol);

      // Smart list continuation
      let prefix = '';
      const listMatch = currentLine.match(/^(\s*[-*+]\s+)/);
      const numMatch = currentLine.match(/^(\s*)(\d+)\.\s+/);
      if (listMatch && before.length > listMatch[1].length) {
        prefix = listMatch[1];
      } else if (numMatch && before.length > numMatch[0].length) {
        const num = parseInt(numMatch[2]) + 1;
        prefix = `${numMatch[1]}${num}. `;
      }

      const newLines = [...lines];
      newLines[cursorLine] = before;
      newLines.splice(cursorLine + 1, 0, prefix + after);
      setContent(newLines.join('\n'));
      setCursorLine((prev) => prev + 1);
      setCursorCol(prefix.length);
      return;
    }

    // Regular text input - filter out control characters
    if (input && !key.ctrl && !key.meta && input.charCodeAt(0) >= 32) {
      setSaved(false);
      const currentLine = lines[cursorLine] || '';
      let textToInsert = input;
      let extraCursorMove = 0;

      // Auto-format lists: add space after list markers
      // e.g., "-item" becomes "- item", ">quote" becomes "> quote"
      if (cursorCol === 1 && input !== ' ') {
        const firstChar = currentLine[0];
        if (firstChar === '-' || firstChar === '+' || firstChar === '>') {
          textToInsert = ' ' + input;
          extraCursorMove = 1;
        }
      }
      // Auto-format numbered lists: "1.item" becomes "1. item"
      if (cursorCol >= 2 && input !== ' ') {
        const beforeCursor = currentLine.slice(0, cursorCol);
        if (/^\d+\.$/.test(beforeCursor)) {
          textToInsert = ' ' + input;
          extraCursorMove = 1;
        }
      }

      const newLine = currentLine.slice(0, cursorCol) + textToInsert + currentLine.slice(cursorCol);
      const newLines = [...lines];
      newLines[cursorLine] = newLine;
      setContent(newLines.join('\n'));
      setCursorCol((prev) => prev + input.length + extraCursorMove);
    }
  });

  // Ensure cursor is within bounds
  useEffect(() => {
    const lineLength = lines[cursorLine]?.length || 0;
    if (cursorCol > lineLength) {
      setCursorCol(lineLength);
    }
  }, [cursorLine, cursorCol, lines]);

  const visibleLines = 12;
  const startLine = Math.max(0, cursorLine - Math.floor(visibleLines / 2));
  const endLine = Math.min(totalLines, startLine + visibleLines);
  const displayLines = lines.slice(startLine, endLine);
  const isEmpty = content.trim() === '';

  // Show status screen when saving/publishing
  if (status === 'saving') {
    return (
      <Box flexDirection="column" paddingX={1} paddingY={2}>
        <Text color="green">✓ Saving draft...</Text>
      </Box>
    );
  }

  if (status === 'publishing') {
    return (
      <Box flexDirection="column" paddingX={1} paddingY={2}>
        <Text color="cyan">✓ Saving and publishing...</Text>
        <Text color="gray">  Your post will be live shortly</Text>
      </Box>
    );
  }

  if (status === 'confirm-exit') {
    return (
      <Box flexDirection="column" paddingX={1} paddingY={2}>
        <Text bold>Before you go...</Text>
        <Text> </Text>
        <Box flexDirection="column" gap={0}>
          <Text><Text color="green" bold>S</Text><Text color="gray"> — Save draft</Text></Text>
          {onPublish && (
            <Text><Text color="cyan" bold>P</Text><Text color="gray"> — Save and publish</Text></Text>
          )}
          <Text><Text color="red" bold>D</Text><Text color="gray"> — Discard changes</Text></Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" paddingX={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">{title}</Text>
        <Text color="gray"> — </Text>
        <Text color={saved ? 'gray' : 'yellow'}>{saved ? 'saved' : 'unsaved'}</Text>
      </Box>

      {/* Editor area */}
      <Box
        borderStyle="round"
        borderColor="gray"
        flexDirection="column"
        paddingX={1}
        paddingY={0}
      >
        {displayLines.map((line, idx) => {
          const actualLineNum = startLine + idx;
          const isCurrentLine = actualLineNum === cursorLine;

          // Show placeholder on first line when empty
          if (isEmpty && actualLineNum === 0) {
            return (
              <Box key={actualLineNum}>
                <Text color="gray" dimColor>{'\x1b[7m \x1b[0m'}Start writing here...</Text>
              </Box>
            );
          }

          // Apply highlighting and cursor
          let highlighted: string;
          if (isCurrentLine) {
            const before = highlightMarkdown(line.slice(0, cursorCol));
            const cursor = line[cursorCol] || ' ';
            const after = highlightMarkdown(line.slice(cursorCol + 1));
            // Use inverse for cursor
            highlighted = before + '\x1b[7m' + cursor + '\x1b[0m' + after;
          } else {
            highlighted = highlightMarkdown(line || ' ');
          }

          return (
            <Box key={actualLineNum}>
              <Text>{highlighted}</Text>
            </Box>
          );
        })}
        {/* Fill empty lines if needed */}
        {displayLines.length < visibleLines &&
          Array(visibleLines - displayLines.length).fill(0).map((_, i) => (
            <Box key={`empty-${i}`}>
              <Text> </Text>
            </Box>
          ))
        }
      </Box>

      {/* Hint line */}
      <Box marginTop={1} marginBottom={1}>
        <Text color="gray" italic>{hint}</Text>
      </Box>

      {/* Action bar */}
      <Box>
        <Text color="gray">ESC exit  </Text>
        <Text color="gray">Ctrl+S </Text>
        <Text color="green" bold>save</Text>
        {onPublish && (
          <>
            <Text color="gray">  Ctrl+P </Text>
            <Text color="cyan" bold>publish</Text>
          </>
        )}
      </Box>
    </Box>
  );
}

import React from 'react';
import { TextAttributes } from '@opentui/core';

interface HelpModalProps {
  isVisible: boolean;
}

export default function HelpModal({ isVisible }: HelpModalProps) {
  if (!isVisible) return null;

  return (
    <box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'transparent',
        justifyContent: "center",
        alignItems: "center"
      }}
    >
      <box
        style={{
          border: true,
          borderColor: "#50fa7b",
          backgroundColor: '#282a36',
          padding: 2,
          width: 60,
          maxHeight: 20,
          flexDirection: "column"
        }}
      >
        <text style={{ fg: '#50fa7b', marginBottom: 1, attributes: TextAttributes.BOLD }} wrap={false}>
          🚀 LazyGitLab - Keyboard Shortcuts
        </text>

        <box style={{ flexDirection: "column", gap: 0.5 }}>
          <box style={{ flexDirection: "row" }}>
            <box style={{ width: 12 }}>
              <text style={{ fg: '#f1fa8c', attributes: TextAttributes.BOLD }} wrap={false}>j/k</text>
            </box>
            <text style={{ fg: '#f8f8f2' }} wrap={false}>Navigate up/down</text>
          </box>

          <box style={{ flexDirection: "row" }}>
            <box style={{ width: 12 }}>
              <text style={{ fg: '#f1fa8c', attributes: TextAttributes.BOLD }} wrap={false}>Enter</text>
            </box>
            <text style={{ fg: '#f8f8f2' }} wrap={false}>Select merge request</text>
          </box>

          <box style={{ flexDirection: "row" }}>
            <box style={{ width: 12 }}>
              <text style={{ fg: '#f1fa8c', attributes: TextAttributes.BOLD }} wrap={false}>f</text>
            </box>
            <text style={{ fg: '#f8f8f2' }} wrap={false}>Filter MRs by state (open/closed/merged)</text>
          </box>

          <box style={{ flexDirection: "row" }}>
            <box style={{ width: 12 }}>
              <text style={{ fg: '#f1fa8c', attributes: TextAttributes.BOLD }} wrap={false}>i</text>
            </box>
            <text style={{ fg: '#f8f8f2' }} wrap={false}>Open job log (in Details pane)</text>
          </box>

          <box style={{ flexDirection: "row" }}>
            <box style={{ width: 12 }}>
              <text style={{ fg: '#f1fa8c', attributes: TextAttributes.BOLD }} wrap={false}>m</text>
            </box>
            <text style={{ fg: '#f8f8f2' }} wrap={false}>Monitor running job (in Details pane)</text>
          </box>

          <box style={{ flexDirection: "row" }}>
            <box style={{ width: 12 }}>
              <text style={{ fg: '#f1fa8c', attributes: TextAttributes.BOLD }} wrap={false}>?</text>
            </box>
            <text style={{ fg: '#f8f8f2' }} wrap={false}>Show this help</text>
          </box>

          <box style={{ flexDirection: "row" }}>
            <box style={{ width: 12 }}>
              <text style={{ fg: '#f1fa8c', attributes: TextAttributes.BOLD }} wrap={false}>Esc</text>
            </box>
            <text style={{ fg: '#f8f8f2' }} wrap={false}>Close help modal</text>
          </box>

          <box style={{ flexDirection: "row" }}>
            <box style={{ width: 12 }}>
              <text style={{ fg: '#f1fa8c', attributes: TextAttributes.BOLD }} wrap={false}>Ctrl+C</text>
            </box>
            <text style={{ fg: '#f8f8f2' }} wrap={false}>Quit application</text>
          </box>
        </box>

        <text style={{ fg: '#6272a4', marginTop: 1, attributes: TextAttributes.DIM }} wrap={false}>
          Press Esc to close this help
        </text>
      </box>
    </box>
  );
}
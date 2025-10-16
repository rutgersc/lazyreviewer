import { useState, useEffect, useRef } from "react";
import { useKeyboard } from "@opentui/react";
import { TextAttributes, type ParsedKey } from "@opentui/core";
import { Colors } from "../colors";
import { useAppStore } from "../store/appStore";
import { retargetMergeRequest } from "../mergerequests/mergerequests-effects";

interface RetargetModalProps {
  isVisible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RetargetModal({
  isVisible,
  onClose,
  onSuccess
}: RetargetModalProps) {
  const mergeRequests = useAppStore(state => state.mergeRequests);
  const selectedMrIndex = useAppStore(state => state.selectedMergeRequest);
  const mrState = useAppStore(state => state.mrState);
  const userSelections = useAppStore(state => state.userSelections);
  const selectedUserSelectionEntry = useAppStore(state => state.selectedUserSelectionEntry);
  const lastTargetBranch = useAppStore(state => state.lastTargetBranch);
  const setLastTargetBranch = useAppStore(state => state.setLastTargetBranch);

  const selectedMr = mergeRequests[selectedMrIndex];
  const selectionEntry = userSelections[selectedUserSelectionEntry];

  const [inputValue, setInputValue] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const prevVisibleRef = useRef(false);

  useEffect(() => {
    if (isVisible && !prevVisibleRef.current) {
      const currentMr = mergeRequests[selectedMrIndex];
      setInputValue(lastTargetBranch || currentMr?.targetbranch || "");
      setErrorMessage(null);
      setIsProcessing(false);
    }
    prevVisibleRef.current = isVisible;
  }, [isVisible, lastTargetBranch, mergeRequests, selectedMrIndex]);

  const handleRetarget = async () => {
    if (!selectedMr || !selectionEntry) {
      setErrorMessage("No merge request selected");
      return;
    }

    if (!inputValue.trim()) {
      setErrorMessage("Branch name cannot be empty");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    const result = await retargetMergeRequest(
      selectionEntry.name,
      selectedMr.id,
      selectedMr.project.fullPath,
      selectedMr.iid,
      inputValue.trim(),
      mrState
    );

    setIsProcessing(false);

    if (result.success) {
      setLastTargetBranch(inputValue.trim());
      onSuccess();
      onClose();
    } else {
      setErrorMessage(result.error || "Failed to retarget merge request");
    }
  };

  useKeyboard((key: ParsedKey) => {
    if (!isVisible || isProcessing) return;

    switch (key.name) {
      case 'escape':
        onClose();
        break;
      case 'return':
        handleRetarget();
        break;
      case 'backspace':
        setInputValue(prev => prev.slice(0, -1));
        break;
      default:
        if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
          setInputValue(prev => prev + key.sequence);
        }
        break;
    }
  });

  if (!isVisible) return null;

  if (!selectedMr) {
    return (
      <box
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "transparent",
          justifyContent: "center",
          alignItems: "center",
          zIndex: 1000,
        }}
      >
        <box
          style={{
            width: 60,
            border: true,
            borderColor: Colors.ERROR,
            backgroundColor: Colors.BACKGROUND,
            padding: 2,
            flexDirection: "column",
            gap: 1,
          }}
        >
          <text
            style={{
              fg: Colors.ERROR,
              attributes: TextAttributes.BOLD,
            }}
            wrap={false}
          >
            Error: No Merge Request Selected
          </text>
          <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}>
            Press ESC to close
          </text>
        </box>
      </box>
    );
  }

  return (
    <box
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "transparent",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
      }}
    >
      <box
        style={{
          width: 70,
          border: true,
          borderColor: Colors.INFO,
          backgroundColor: Colors.BACKGROUND,
          padding: 2,
          flexDirection: "column",
          gap: 1,
        }}
      >
        <text
          style={{
            fg: Colors.INFO,
            attributes: TextAttributes.BOLD,
          }}
          wrap={false}
        >
          Retarget Merge Request
        </text>

        <text style={{ fg: Colors.NEUTRAL }} wrap={true}>
          MR !{selectedMr.iid}: {selectedMr.title}
        </text>

        <text
          style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}
          wrap={false}
        >
          Current target: {selectedMr.targetbranch}
        </text>

        <box style={{ marginTop: 1, flexDirection: "column" }}>
          <text style={{ fg: Colors.PRIMARY }} wrap={false}>
            New target branch:
          </text>
          <box
            style={{
              marginTop: 0.5,
              border: true,
              borderColor: errorMessage ? Colors.ERROR : Colors.SUCCESS,
              paddingLeft: 1,
              paddingRight: 1,
            }}
          >
            <text style={{ fg: Colors.PRIMARY }} wrap={false}>
              {inputValue}
              <text style={{ fg: Colors.SUCCESS }}>▋</text>
            </text>
          </box>
        </box>

        {errorMessage && (
          <text style={{ fg: Colors.ERROR, marginTop: 0.5 }} wrap={true}>
            Error: {errorMessage}
          </text>
        )}

        {isProcessing ? (
          <text
            style={{
              fg: Colors.WARNING,
              marginTop: 1,
              attributes: TextAttributes.BOLD,
            }}
            wrap={false}
          >
            Processing...
          </text>
        ) : (
          <box style={{ marginTop: 1, flexDirection: "column" }}>
            <text style={{ fg: Colors.SUCCESS }}>
              Press Enter to confirm
            </text>
            <text style={{ fg: Colors.ERROR }}>
              Press ESC to cancel
            </text>
          </box>
        )}
      </box>
    </box>
  );
}

import { useKeyboard } from "@opentui/react";
import { TextAttributes, type ParsedKey } from "@opentui/core";
import { Colors } from "../colors";
import { useAtomValue, useAtomSet } from '@effect-atom/atom-react';
import { selectedMrIndexAtom, unwrappedMergeRequestsAtom } from '../mergerequests/mergerequests-atom';
import { lastTargetBranchAtom } from '../git/git-atom';

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
  const mergeRequests = useAtomValue(unwrappedMergeRequestsAtom);
  const selectedMrIndex = useAtomValue(selectedMrIndexAtom);

  const selectedMr = mergeRequests[selectedMrIndex];

  // const mrState = useAppStore(state => state.mrState);
  // const userSelections = useAppStore(state => state.userSelections);
  // const selectedUserSelectionEntry = useAppStore(state => state.selectedUserSelectionEntry);
  const lastTargetBranch = useAtomValue(lastTargetBranchAtom);
  const setLastTargetBranch = useAtomSet(lastTargetBranchAtom);
  // const selectionEntry = userSelections[selectedUserSelectionEntry];

  // const [inputValue, setInputValue] = useState("");
  // const [isProcessing, setIsProcessing] = useState(false);
  // const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // useEffect(() => {
  //   if (isVisible && !prevVisibleRef.current) {
  //     const currentMr = mergeRequests[selectedMrIndex];
  //     setInputValue(lastTargetBranch || currentMr?.targetbranch || "");
  //     setErrorMessage(null);
  //     setIsProcessing(false);
  //   }
  //   prevVisibleRef.current = isVisible;
  // }, [isVisible, lastTargetBranch, mergeRequests, selectedMrIndex]);

  // const handleRetarget = async () => {
  //   if (!selectedMr || !selectionEntry) {
  //     setErrorMessage("No merge request selected");
  //     return;
  //   }

  //   if (!inputValue.trim()) {
  //     setErrorMessage("Branch name cannot be empty");
  //     return;
  //   }

  //   setIsProcessing(true);
  //   setErrorMessage(null);

  //   const result = await retargetMergeRequest(
  //     selectionEntry.name,
  //     selectedMr.id,
  //     selectedMr.project.fullPath,
  //     selectedMr.iid,
  //     inputValue.trim(),
  //     mrState
  //   );

  //   setIsProcessing(false);

  //   if (result.success) {
  //     setLastTargetBranch(inputValue.trim());
  //     onSuccess();
  //     onClose();
  //   } else {
  //     setErrorMessage(result.error || "Failed to retarget merge request");
  //   }
  // };

  useKeyboard((key: ParsedKey) => {
    if (!isVisible) return;

    switch (key.name) {
      case 'escape':
        onClose();
        break;
      // case 'return':
      //   handleRetarget();
      //   break;
      // case 'backspace':
      //   setInputValue(prev => prev.slice(0, -1));
      //   break;
      // default:
      //   if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      //     setInputValue(prev => prev + key.sequence);
      //   }
      //   break;
    }
  });

  if (!isVisible) return null;

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
          wrapMode='none'
        >
          Retarget Merge Request
        </text>

        {selectedMr ? (
          <>
            <text style={{ fg: Colors.NEUTRAL }} wrapMode='word'>
              MR !{selectedMr.iid}: {selectedMr.title}
            </text>

            <text
              style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }}
              wrapMode='none'
            >
              Current target: {selectedMr.targetbranch}
            </text>

            <text style={{ fg: Colors.NEUTRAL, marginTop: 1 }} wrapMode='word'>
              [TODO: Add input functionality]
            </text>
          </>
        ) : (
          <text style={{ fg: Colors.ERROR }} wrapMode='word'>
            No merge request selected
          </text>
        )}

        <box style={{ marginTop: 1, flexDirection: "column" }}>
          <text style={{ fg: Colors.ERROR }}>
            Press ESC to cancel
          </text>
        </box>
      </box>
    </box>
  );
}

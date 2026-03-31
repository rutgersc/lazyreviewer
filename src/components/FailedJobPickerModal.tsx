import { useKeyboard } from "@opentui/react";
import { TextAttributes, type ParsedKey } from "@opentui/core";
import { Colors } from "../colors";
import { useState } from "react";
import { Atom } from "effect/unstable/reactivity"
import { useAtomValue, useAtomSet } from "@effect/atom-react";
import type { PipelineJob, PipelineStage } from "../domain/merge-request-schema";
import type { MergeRequest } from "./MergeRequestPane";
import { loadJobLogAtom, jobLogDownloadSignalAtom } from "../mergerequests/open-pipelinejob-log-atom";
import { getJobStatusDisplay } from "../domain/display/jobStatus";

export const failedJobPickerItemsAtom = Atom.make<readonly { job: PipelineJob; stage: PipelineStage }[]>([]);
export const failedJobPickerMrAtom = Atom.make<MergeRequest | null>(null);
export const lastPickedFailedJobAtom = Atom.make<string | null>(null);

interface FailedJobPickerModalProps {
  onClose: () => void;
}

export default function FailedJobPickerModal({ onClose }: FailedJobPickerModalProps) {
  const items = useAtomValue(failedJobPickerItemsAtom);
  const mr = useAtomValue(failedJobPickerMrAtom);
  const lastPicked = useAtomValue(lastPickedFailedJobAtom);
  const setLastPicked = useAtomSet(lastPickedFailedJobAtom);
  const setLoadJobLog = useAtomSet(loadJobLogAtom, { mode: 'promiseExit' });
  const setDownloadSignal = useAtomSet(jobLogDownloadSignalAtom);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const sortedItems = sortLastPickedFirst(items, lastPicked);

  const confirmSelection = (index: number) => {
    const item = sortedItems[index];
    if (!item || !mr) return;
    setLastPicked(item.job.name);
    setLoadJobLog({ mergeRequest: mr, job: item.job }).then(() => {
      setDownloadSignal(Date.now());
    });
    onClose();
  };

  useKeyboard((key: ParsedKey) => {
    const num = parseInt(key.name);
    if (!isNaN(num) && num >= 0 && num < sortedItems.length) {
      confirmSelection(num);
      return;
    }

    switch (key.name) {
      case 'j':
      case 'down':
        setSelectedIndex(i => Math.min(i + 1, sortedItems.length - 1));
        break;
      case 'k':
      case 'up':
        setSelectedIndex(i => Math.max(i - 1, 0));
        break;
      case 'return':
        confirmSelection(selectedIndex);
        break;
      case 'escape':
        onClose();
        break;
    }
  });

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
          width: 80,
          border: true,
          borderColor: Colors.ERROR,
          backgroundColor: Colors.BACKGROUND,
          padding: 2,
          flexDirection: "column",
          gap: 1,
        }}
      >
        <text
          style={{ fg: Colors.PRIMARY, attributes: TextAttributes.BOLD }}
          wrapMode='none'
        >
          Inspect Failed Job
        </text>

        <box style={{ flexDirection: "column" }}>
          {sortedItems.map(({ stage, job }, i) => (
            <text
              key={job.id}
              style={{
                fg: i === selectedIndex ? Colors.PRIMARY : Colors.NEUTRAL,
                attributes: i === selectedIndex ? TextAttributes.BOLD : 0,
              }}
              wrapMode='none'
            >
              {i === selectedIndex ? '> ' : '  '}
              [{i}] {getJobStatusDisplay(job.status).symbol} {stage.name}: {job.name}
            </text>
          ))}
        </box>

        <text style={{ fg: Colors.NEUTRAL, attributes: TextAttributes.DIM }} wrapMode='none'>
          0-{sortedItems.length - 1}/j/k to select, Enter to confirm, ESC to cancel
        </text>
      </box>
    </box>
  );
}

const sortLastPickedFirst = (
  items: readonly { job: PipelineJob; stage: PipelineStage }[],
  lastPickedName: string | null,
): readonly { job: PipelineJob; stage: PipelineStage }[] => {
  if (!lastPickedName) return items;
  const lastPickedIndex = items.findIndex(item => item.job.name === lastPickedName);
  if (lastPickedIndex <= 0) return items;
  return [items[lastPickedIndex]!, ...items.slice(0, lastPickedIndex), ...items.slice(lastPickedIndex + 1)];
};
